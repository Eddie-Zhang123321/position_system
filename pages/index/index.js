// 首页：欢迎、绑定状态、快捷入口、最新签到
const app = getApp()
import api from '../../utils/api'
import auth from '../../utils/auth'

// 格式化时间：后端返 UTC，手动解析 +8 转北京时间
const formatRecordTime = (timeStr) => {
  if (!timeStr) return ''
  const m = timeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return timeStr.substring(0, 16).replace('T', ' ')
  const bj = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + 8 * 36e5)
  const pad = n => String(n).padStart(2, '0')
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`
}

Page({
  data: {
    isLoading: true,
    isLoginLoading: false,
    userInfo: null,
    nickname: '',
    seatId: null,
    signRecords: [],
    countdown: { days: '--', hours: '--', minutes: '--', seconds: '--' }
  },

  onShow() {
    this.initPage()
    this.startCountdown()
  },

  onHide() {
    this.stopCountdown()
  },

  onUnload() {
    this.stopCountdown()
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
      nickname: data.name || data.nickName || '',
      seatId: data.table_id || null
    })
  },

  // 昵称输入完成时同步
  async onNicknameBlur(e) {
    const nickname = e.detail.value
    this.setData({ nickname })
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
    let records = Array.isArray(list) ? list : []
    records = records
      .map(r => ({ ...r, sign_in_time: formatRecordTime(r.sign_in_time) }))
      .sort((a, b) => b.sign_in_time.localeCompare(a.sign_in_time))
      .slice(0, 3)
    this.setData({
      signRecords: records,
      isLoading: false
    })
  },

  goSeat() {
    wx.switchTab({ url: '/pages/seat/seat' })
  },

  goSign() {
    wx.switchTab({ url: '/pages/sign/sign' })
  },

  async goAdmin() {
    try {
      wx.showLoading({ title: '权限检查...' })
      // 先行校验，避免进入页面后再被踢出
      const ok = await auth.isAdmin()
      wx.hideLoading()
      if (!ok) {
        wx.showToast({ title: '需要管理员权限', icon: 'none' })
        return
      }
      wx.navigateTo({ url: '/pages/admin/admin' })
    } catch (err) {
      wx.hideLoading()
      console.error('管理员校验失败', err)
      wx.showToast({ title: '校验失败，请重试', icon: 'none' })
    }
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  // 考研倒计时 - 2026年12月18日 08:30
  countdownTimer: null,

  startCountdown() {
    this.updateCountdown()
    this.countdownTimer = setInterval(() => {
      this.updateCountdown()
    }, 1000)
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  },

  updateCountdown() {
    const examDate = new Date(2026, 11, 18, 8, 30, 0) // 12月18日 08:30
    const now = new Date()
    let diff = examDate - now

    if (diff <= 0) {
      this.setData({
        countdown: { days: '0', hours: '00', minutes: '00', seconds: '00' }
      })
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    diff -= days * 1000 * 60 * 60 * 24
    const hours = Math.floor(diff / (1000 * 60 * 60))
    diff -= hours * 1000 * 60 * 60
    const minutes = Math.floor(diff / (1000 * 60))
    diff -= minutes * 1000 * 60
    const seconds = Math.floor(diff / 1000)

    this.setData({
      countdown: {
        days: String(days),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0')
      }
    })
  }
})
