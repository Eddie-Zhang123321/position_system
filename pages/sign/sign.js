// 获取应用实例
const app = getApp()
import api from '../../utils/api'
import auth from '../../utils/auth'

// 格式化时间：将 2026-04-27T14:30 转为 2026-04-27 14:30
// 格式化时间：后端返 UTC，手动解析 +8 转北京时间
const formatRecordTime = (timeStr) => {
  if (!timeStr) return ''
  const m = timeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return timeStr.substring(0, 16).replace('T', ' ')
  // Date.UTC 强制按 UTC 解析，再 +8h 得到北京时间
  const bj = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + 8 * 36e5)
  const pad = n => String(n).padStart(2, '0')
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`
}

Page({
  data: {
    isLoading: true,
    hasSeat: false,
    seatInfo: null,
    signRecords: [],
    scanResult: null,
    nextSignType: 'In', // 根据最后一条记录自动判断下一次是签到还是签退
    isOnline: false, // 当前在线状态
    viewOpenid: null, // 查看指定用户的 openid（管理员模式）
    viewUserName: '' // 查看的用户名称（管理员模式）
  },

  onLoad: function(options) {
    // 如果传入了 openid，说明是管理员查看指定用户的记录（通过 URL 参数，非 tabBar 跳转）
    if (options.openid) {
      this.setData({ viewOpenid: options.openid })
      this.loadUserRecords(options.openid)
    } else {
      this.checkLoginAndLoadData()
    }
  },

  onShow: function() {
    const app = getApp()
    // 检查全局数据中是否有 viewUserOpenid（管理员从 tabBar 跳转过来）
    if (app.globalData.viewUserOpenid) {
      const viewOpenid = app.globalData.viewUserOpenid
      // 清除全局数据，避免下次进入页面时误触发
      app.globalData.viewUserOpenid = null
      
      // 如果当前不是查看该用户，则加载该用户的记录
      if (this.data.viewOpenid !== viewOpenid) {
        this.setData({ viewOpenid: viewOpenid })
        this.loadUserRecords(viewOpenid)
      }
    } else if (!this.data.viewOpenid) {
      // 如果是查看自己的记录，每次返回页面都重新拉取
      this.checkLoginAndLoadData()
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
        userInfo: data,
        isOnline: data.is_online || false // 保存在线状态
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

  // 加载签到记录（自己的）
  loadSignRecords: function() {
    this.setData({
      isLoading: true
    })

    api.sign.getRecords()
      .then(data => {
        // 按时间倒序排序（最近的在上）
        let sortedRecords = []
        if (data && data.length > 0) {
          sortedRecords = [...data]
            .map(r => ({ ...r, sign_in_time: formatRecordTime(r.sign_in_time) }))
            .sort((a, b) => b.sign_in_time.localeCompare(a.sign_in_time))
        }
        
        // 根据最后一条记录判断下一次是签到还是签退
        let nextType = 'In' // 默认签到
        if (sortedRecords.length > 0) {
          const lastRecord = sortedRecords[0]
          // 如果最后一条是签到，下一次就是签退；如果是签退，下一次就是签到
          nextType = lastRecord.typ === 'In' ? 'Out' : 'In'
        }
        
        this.setData({
          signRecords: sortedRecords, // 使用排序后的数据
          nextSignType: nextType,
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

  // 加载指定用户的签到记录（管理员模式）
  loadUserRecords: function(openid) {
    this.setData({
      isLoading: true
    })

    // 先获取用户信息
    api.user.getUserInfo(openid)
      .then(userInfo => {
        this.setData({
          viewUserName: userInfo.name || '未命名',
          hasSeat: !!userInfo.table_id,
          seatInfo: userInfo.table_id ? { id: userInfo.table_id } : null,
          isOnline: userInfo.is_online || false
        })
      })
      .catch(err => {
        console.warn('获取用户信息失败', err)
      })

    // 获取签到记录
    api.sign.getUserRecords(openid)
      .then(data => {
        // 按时间倒序排序（最近的在上）
        let sortedRecords = []
        if (data && data.length > 0) {
          sortedRecords = [...data]
            .map(r => ({ ...r, sign_in_time: formatRecordTime(r.sign_in_time) }))
            .sort((a, b) => b.sign_in_time.localeCompare(a.sign_in_time))
        }
        
        this.setData({
          signRecords: sortedRecords, // 使用排序后的数据
          isLoading: false
        })
      })
      .catch(err => {
        console.error('加载用户签到记录失败', err)
        this.setData({
          isLoading: false
        })
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      })
  },

  // 扫描签到/签退（自动判断）
  scanSign: function() {
    const type = this.data.nextSignType
    const typeText = type === 'In' ? '签到' : '签退'
    
    wx.scanCode({
      scanType: ['qrCode'],
      success: (res) => {
        const token = res.result
        auth.getLocation()
          .then((location) => {
            this.performSign(token, location.latitude, location.longitude, type)
          })
          .catch((err) => {
            console.error('获取位置失败', err)
            const errMsg = err?.errMsg || ''
            if (errMsg.includes('auth deny') || errMsg.includes('authorize')) {
              wx.showModal({
                title: '需要位置权限',
                content: '签到需要获取您的位置信息，请在设置中开启位置权限',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting()
                  }
                }
              })
            } else {
              wx.showToast({ title: '获取位置失败，请重试', icon: 'none' })
            }
          })
      },
      fail: () => {
        wx.showToast({ title: '扫描已取消', icon: 'none' })
      }
    })
  },

  // 执行签到/签退
  performSign: function(token, latitude, longitude, type) {
    const typeText = type === 'In' ? '签到' : '签退'
    wx.showLoading({
      title: `${typeText}中...`
    })

    const address = '考研教室'
    const apiCall = type === 'In' 
      ? api.sign.signIn(token, address, latitude, longitude)
      : api.sign.signOut(token, address, latitude, longitude)
    
    apiCall
      .then(res => {
        wx.hideLoading()
        console.log(`${typeText}成功`, res)
        
        wx.showToast({
          title: `${typeText}成功`,
          icon: 'success'
        })
        
        // 刷新签到记录和在线状态
        this.loadUserInfo()
      })
      .catch(err => {
        wx.hideLoading()
        console.error(`${typeText}失败`, err)
        
        let errorMsg = `${typeText}失败`
        if (err.statusCode === 401) {
          errorMsg = '二维码已过期或无效'
        } else if (err.statusCode === 400) {
          errorMsg = '您不在地理签到范围内'
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
