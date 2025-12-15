// 获取应用实例
const app = getApp()
import api from '../../utils/api'
import auth from '../../utils/auth'

Page({
  data: {
    tables: [], // 座位列表
    isLoading: true,
    isAdmin: false,
    hasBoundSeat: false,
    boundSeatId: null,
    showQRCode: false,
    qrCodeImage: '',
    qrCodeId: null
  },

  onLoad: function() {
    this.checkLoginAndRole()
  },

  onShow: function() {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        isAdmin: app.globalData.isAdmin
      })
      this.loadTables()
      this.checkBoundSeat()
    }
  },

  // 检查登录和权限
  checkLoginAndRole: function() {
    if (!auth.isLoggedIn()) {
      this.login()
    } else {
      this.getUserRole()
    }
  },

  // 登录
  login: function() {
    wx.showLoading({
      title: '登录中...'
    })

    auth.login()
      .then(data => {
        wx.hideLoading()
        app.globalData.userInfo = data
        app.globalData.token = data.token
        
        this.setData({
          userInfo: data
        })
        
        // 加载座位信息
        this.loadTables()
        this.checkBoundSeat()
      })
      .catch(err => {
        wx.hideLoading()
        console.error('登录失败', err)
        
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        })
      })
  },

  // 获取用户角色
  getUserRole: function() {
    auth.getCurrentUserInfo()
      .then(data => {
        this.setData({
          userInfo: data
        })
        
        // 加载座位信息
        this.loadTables()
        this.checkBoundSeat()
      })
      .catch(err => {
        console.error('获取用户信息失败', err)
        
        // 如果获取失败，可能是token过期，重新登录
        this.login()
      })
  },

  // 检查是否已绑定座位
  checkBoundSeat: function() {
    auth.getCurrentUserInfo()
      .then(data => {
        if (data.table_id) {
          this.setData({
            hasBoundSeat: true,
            boundSeatId: data.table_id
          })
        } else {
          this.setData({
            hasBoundSeat: false,
            boundSeatId: null
          })
        }
      })
      .catch(err => {
        console.error('获取绑定座位信息失败', err)
      })
  },

  // 加载座位信息
  loadTables: function() {
    this.setData({
      isLoading: true
    })

    api.table.getAllTables()
      .then(data => {
        // 转换座位数据，添加状态标识
        const tables = data.map(table => {
          const status = table.bind_user ? 'bound' : 'available'
          return {
            ...table,
            status: status,
            statusText: status === 'available' ? '可用' : '已绑定',
            statusClass: status === 'available' ? 'status-available' : 'status-bound'
          }
        })
        
        // 按照座位ID排序
        tables.sort((a, b) => a.id - b.id)
        
        this.setData({
          tables: tables,
          isLoading: false
        })
      })
      .catch(err => {
        console.error('加载座位信息失败', err)
        
        // 如果是401未授权，可能是token过期
        if (err.statusCode === 401) {
          wx.showToast({
            title: '登录已过期，请重新登录',
            icon: 'none'
          })
          this.login()
        } else {
          this.setData({
            isLoading: false
          })
          
          wx.showToast({
            title: '加载座位信息失败',
            icon: 'none'
          })
        }
      })
  },

  // 选择座位（线上选座）
  selectTable: function(e) {
    const tableId = e.currentTarget.dataset.id
    const table = this.data.tables.find(t => t.id === tableId)
    
    if (!table) return
    
    // 如果是已绑定座位，显示绑定用户信息
    if (table.status === 'bound') {
      wx.showModal({
        title: '座位信息',
        content: `座位 ${table.id} 已被 ${table.bind_user} 绑定`,
        confirmText: '确定'
      })
    } else if (table.status === 'available') {
      // 如果是可用座位，显示选座确认对话框
      wx.showModal({
        title: '确认选座',
        content: `确定要选择座位 ${table.id} 吗？`,
        confirmText: '确定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.bindSeat(tableId)
          }
        }
      })
    }
  },

  // 绑定座位（线上选座）
  bindSeat: function(tableId) {
    // 检查是否已经绑定座位
    if (this.data.hasBoundSeat) {
      wx.showModal({
        title: '已有座位',
        content: '您已经绑定了座位，是否要更换座位？',
        success: (res) => {
          if (res.confirm) {
            this.performBindSeat(tableId)
          }
        }
      })
    } else {
      this.performBindSeat(tableId)
    }
  },

  // 执行绑定座位操作
  performBindSeat: function(tableId) {
    wx.showLoading({
      title: '绑定中...'
    })

    const userInfo = app.globalData.userInfo
    api.table.bind(userInfo.openid, tableId)
      .then(res => {
        wx.hideLoading()
        console.log('绑定座位成功', res)
        
        wx.showToast({
          title: '绑定成功',
          icon: 'success'
        })
        
        // 更新绑定状态
        this.setData({
          hasBoundSeat: true,
          boundSeatId: tableId
        })
        
        // 刷新座位状态
        this.loadTables()
      })
      .catch(err => {
        wx.hideLoading()
        console.error('绑定座位失败', err)
        
        let errorMsg = '绑定失败'
        if (err.statusCode === 409) {
          errorMsg = '该座位已被绑定'
        } else if (err.statusCode === 401) {
          errorMsg = '未授权，请重新登录'
          this.login()
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none'
        })
      })
  },

  // 解绑座位
  unbindSeat: function(e) {
    const tableId = e.currentTarget.dataset.id
    const table = this.data.tables.find(t => t.id === tableId)
    
    // 检查是否是自己的座位
    if (this.data.userInfo.openid !== table.bind_user_openid) {
      wx.showToast({
        title: '只能解绑自己的座位',
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '确认解绑',
      content: '确定要解绑这个座位吗？',
      success: (res) => {
        if (res.confirm) {
          this.performUnbindSeat()
        }
      }
    })
  },

  // 执行解绑操作
  performUnbindSeat: function() {
    wx.showLoading({
      title: '解绑中...'
    })

    const userInfo = app.globalData.userInfo
    api.table.unbind(userInfo.openid)
      .then(res => {
        wx.hideLoading()
        console.log('解绑座位成功', res)
        
        wx.showToast({
          title: '解绑成功',
          icon: 'success'
        })
        
        // 更新绑定状态
        this.setData({
          hasBoundSeat: false,
          boundSeatId: null
        })
        
        // 刷新座位状态
        this.loadTables()
      })
      .catch(err => {
        wx.hideLoading()
        console.error('解绑座位失败', err)
        
        wx.showToast({
          title: '解绑失败',
          icon: 'none'
        })
      })
  },

  // 获取座位二维码
  getSeatQRCode: function(e) {
    const tableId = e.currentTarget.dataset.id
    
    wx.showLoading({
      title: '获取中...'
    })
    
    api.table.getQRCode(tableId)
      .then(res => {
        wx.hideLoading()
        // res 为 arraybuffer，转 base64
        const base64 = wx.arrayBufferToBase64(res)
        const img = `data:image/png;base64,${base64}`
        this.setData({
          showQRCode: true,
          qrCodeImage: img,
          qrCodeId: tableId
        })
      })
      .catch(err => {
        wx.hideLoading()
        console.error('获取二维码失败', err)
        
        wx.showToast({
          title: '获取二维码失败',
          icon: 'none'
        })
      })
  },

  // 关闭二维码
  closeQRCode: function() {
    this.setData({
      showQRCode: false,
      qrCodeImage: '',
      qrCodeId: null
    })
  },

  // 进入签到页面
  goSign: function(e) {
    const tableId = e.currentTarget.dataset.id
    
    // 如果未绑定座位，提示用户先绑定
    if (!this.data.hasBoundSeat) {
      wx.showToast({
        title: '请先绑定座位',
        icon: 'none'
      })
      return
    }
    
    // 保存选中的座位ID到全局数据
    app.globalData.selectedTableId = tableId
    
    // 跳转到签到页面
    wx.navigateTo({
      url: '/pages/sign/sign'
    })
  },

  onPullDownRefresh() {
    this.loadTables()
    this.checkBoundSeat()
    wx.stopPullDownRefresh()
  }
})
