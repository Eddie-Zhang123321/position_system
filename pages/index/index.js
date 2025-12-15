// 首页：欢迎、绑定状态、快捷入口、最新签到
const app = getApp()
import api from '../../utils/api'
import auth from '../../utils/auth'

Page({
  data: {
    isLoading: true,
    isLoginLoading: false,
    userInfo: null,
    hasProfile: false,
    seatId: null,
    signRecords: []
  },

  onShow() {
    this.initPage()
  },

  async initPage() {
    try {
      if (!auth.isLoggedIn()) {
        await this.handleLogin()
      }
      await this.loadUserInfo()
      await this.loadLatestRecords()
    } catch (err) {
      console.error('首页初始化失败', err)
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' })
      this.setData({ isLoading: false })
    }
  },

  async handleLogin() {
    this.setData({ isLoginLoading: true })
    await auth.login()
    this.setData({ isLoginLoading: false })
  },

  async loadUserInfo() {
    const data = await auth.getCurrentUserInfo()
    app.globalData.userInfo = data
    this.setData({
      userInfo: data,
      seatId: data.table_id || null,
      hasProfile: !!data.name || !!data.nickname || !!data.nickName
    })
  },

  // 申请微信头像昵称授权并同步昵称到后端
  requestProfile() {
    wx.getUserProfile({
      desc: '用于完善头像与昵称',
      success: async (res) => {
        const info = res.userInfo
        // 本地展示
        this.setData({
          userInfo: {
            ...this.data.userInfo,
            nickName: info.nickName,
            avatarUrl: info.avatarUrl
          },
          hasProfile: true
        })
        // 同步昵称到后端（若接口存在）
        try {
          await api.user.setName(info.nickName)
        } catch (err) {
          console.warn('同步昵称失败，可稍后重试', err)
        }
      },
      fail: () => {
        wx.showToast({ title: '未授权头像昵称', icon: 'none' })
      }
    })
  },

  async loadLatestRecords() {
    this.setData({ isLoading: true })
    const list = await api.sign.getRecords()
    this.setData({
      signRecords: Array.isArray(list) ? list.slice(0, 3) : [],
      isLoading: false
    })
  },

  goSeat() {
    wx.switchTab({ url: '/pages/seat/seat' })
  },

  goSign() {
    wx.switchTab({ url: '/pages/sign/sign' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  }
})
