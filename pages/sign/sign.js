// 获取应用实例
const app = getApp()
import api from '../../utils/api'
import auth from '../../utils/auth'

Page({
  data: {
    isLoading: true,
    hasSeat: false,
    seatInfo: null,
    signRecords: [],
    scanResult: null
  },

  onLoad: function() {
    this.checkLoginAndLoadData()
  },

  onShow: function() {
    // 从全局数据获取选中的座位ID
    const selectedTableId = app.globalData.selectedTableId
    
    // 如果有选中的座位，加载签到记录
    if (selectedTableId) {
      this.loadSignRecords()
    }
  },

  // 检查登录并加载数据
  checkLoginAndLoadData: function() {
    if (!auth.isLoggedIn()) {
      this.login()
    } else {
      this.loadUserInfo()
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
        
        // 加载用户信息
        this.loadUserInfo()
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

  // 加载用户信息
  loadUserInfo: function() {
    auth.getCurrentUserInfo()
      .then(data => {
        this.setData({
          userInfo: data
        })
        
        // 检查是否绑定座位
        if (data.table_id) {
          this.setData({
            hasSeat: true,
            seatInfo: {
              id: data.table_id,
              name: data.name
            }
          })
        } else {
          this.setData({
            hasSeat: false,
            seatInfo: null
          })
        }
        
        // 加载签到记录
        this.loadSignRecords()
      })
      .catch(err => {
        console.error('获取用户信息失败', err)
        
        // 如果获取失败，可能是token过期，重新登录
        this.login()
      })
  },

  // 加载签到记录
  loadSignRecords: function() {
    this.setData({
      isLoading: true
    })

    api.sign.getRecords()
      .then(data => {
        this.setData({
          signRecords: data,
          isLoading: false
        })
      })
      .catch(err => {
        console.error('加载签到记录失败', err)
        
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
            title: '加载签到记录失败',
            icon: 'none'
          })
        }
      })
  },

  // 扫描签到
  scanSignIn: function() {
    wx.scanCode({
      scanType: ['qrCode'],
      success: (res) => {
        const token = res.result
        auth.getLocation()
          .then((location) => {
            this.performSignIn(token, location.latitude, location.longitude)
          })
          .catch((err) => {
            console.error('获取位置失败', err)
            wx.showToast({ title: '获取位置失败', icon: 'none' })
          })
      },
      fail: () => {
        wx.showToast({ title: '扫描已取消', icon: 'none' })
      }
    })
  },

  // 执行签到
  performSignIn: function(token, latitude, longitude) {
    wx.showLoading({
      title: '签到中...'
    })

    const address = '考研教室'
    api.sign.signIn(token, address, latitude, longitude)
      .then(res => {
        wx.hideLoading()
        console.log('签到成功', res)
        
        wx.showToast({
          title: '签到成功',
          icon: 'success'
        })
        
        // 刷新签到记录
        this.loadSignRecords()
      })
      .catch(err => {
        wx.hideLoading()
        console.error('签到失败', err)
        
        let errorMsg = '签到失败'
        if (err.statusCode === 401) {
          errorMsg = '二维码已过期或无效'
        } else if (err.statusCode === 400) {
          errorMsg = '请求参数错误'
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none'
        })
      })
  },

  // 返回选座
  goBack: function() {
    wx.switchTab({ url: '/pages/seat/seat' })
  }
})
