// 首页：欢迎、绑定状态、快捷入口、最新签到
const app = getApp()
import api from '../../utils/api'
import auth from '../../utils/auth'

Page({
  data: {
    isLoading: true,
    isLoginLoading: false,
    userInfo: null,
    avatarUrl: '',
    nickname: '',
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
      avatarUrl: data.avatarUrl || '',
      nickname: data.name || data.nickName || '',
      seatId: data.table_id || null,
      hasProfile: !!data.name || !!data.nickname || !!data.nickName
    })
  },

  // 头像选择（官方 chooseAvatar）
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    this.setData({
      avatarUrl,
      userInfo: {
        ...this.data.userInfo,
        avatarUrl
      },
      hasProfile: !!(this.data.nickname || this.data.userInfo?.name || this.data.userInfo?.nickName)
    })
    // 如需上传头像到后端，可在此追加接口调用
  },

  // 昵称输入完成时同步
  async onNicknameBlur(e) {
    const nickname = e.detail.value
    this.setData({
      nickname,
      userInfo: {
        ...this.data.userInfo,
        nickName: nickname,
        name: this.data.userInfo?.name || nickname
      },
      hasProfile: !!nickname
    })
    if (nickname) {
      try {
        await api.user.setName(nickname)
      } catch (err) {
        console.warn('同步昵称失败，可稍后重试', err)
      }
    }
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
