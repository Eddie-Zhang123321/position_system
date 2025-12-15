App({
  onLaunch: function () {
    // 检查登录状态
    this.checkLoginStatus()
  },
  
  globalData: {
    userInfo: null,
    token: null,
    isAdmin: false
  },
  
  // 检查登录状态
  checkLoginStatus: function() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
      this.getUserInfo()
    }
  },
  
  // 获取用户信息
  getUserInfo: function() {
    const auth = require('./utils/auth')
    auth.getCurrentUserInfo()
      .then(data => {
        this.globalData.userInfo = data
        // 检查是否为管理员
        auth.isAdmin()
          .then(isAdmin => {
            this.globalData.isAdmin = isAdmin
          })
          .catch(err => {
            console.error('检查管理员身份失败', err)
          })
      })
      .catch(err => {
        console.error('获取用户信息失败', err)
        // 登录失败，清除token
        auth.clearToken()
        this.globalData.token = null
        this.globalData.userInfo = null
      })
  }
})
