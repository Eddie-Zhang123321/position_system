import auth from '../../utils/auth';

Page({
  data: {
    isLoading: false,
    userInfo: {},
    hasUserInfo: false
  },

  onLoad: function () {
    // 如果已登录，直接跳转到首页
    if (auth.checkAuth()) {
      wx.switchTab({
        url: '/pages/index/index'
      });
      return;
    }
    
    // 检查是否已获取用户信息
    const app = getApp();
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      });
    }
  },
  
  // 获取用户信息
  getUserInfo: function(e) {
    if (e.detail.userInfo) {
      this.setData({
        userInfo: e.detail.userInfo,
        hasUserInfo: true
      });
    }
  },
  
  // 登录
  login: function() {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true
    });
    
    auth.login()
      .then(() => {
        this.setData({ isLoading: false })
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 1200)
      })
      .catch(err => {
        console.error('登录失败', err)
        this.setData({ isLoading: false })
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      })
  }
});
