import api from '../../utils/api'
import auth from '../../utils/auth'

Page({
  data: {
    isLoading: true,
    tables: [],
    users: [],
    records: []
  },

  async onShow() {
    try {
      await this.ensureAdmin()
      await this.loadAllData()
    } catch (err) {
      console.error('管理员页面加载失败', err)
    }
  },

  async ensureAdmin() {
    if (!auth.isLoggedIn()) {
      await auth.login()
    }
    const isAdmin = await auth.isAdmin()
    if (!isAdmin) {
      wx.showToast({ title: '需要管理员权限', icon: 'none' })
      wx.switchTab({ url: '/pages/index/index' })
      throw new Error('not admin')
    }
  },

  async loadAllData() {
    this.setData({ isLoading: true })
    const [tables, users, records] = await Promise.all([
      api.table.getAllTables(),
      api.user.getAllUsers(),
      api.sign.getAllRecords()
    ])
    this.setData({
      tables: tables || [],
      users: users || [],
      records: records || [],
      isLoading: false
    })
  },

  async createSeat() {
    wx.showLoading({ title: '创建中...' })
    try {
      await api.table.create()
      wx.showToast({ title: '创建成功' })
      await this.loadAllData()
    } catch (err) {
      console.error('创建座位失败', err)
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async unbindSeat(e) {
    const { openid } = e.currentTarget.dataset
    if (!openid) return
    wx.showModal({
      title: '确认解绑',
      content: '确定解绑该座位吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '解绑中...' })
        try {
          await api.table.unbind(openid)
          wx.showToast({ title: '解绑成功' })
          await this.loadAllData()
        } catch (err) {
          console.error('解绑失败', err)
          wx.showToast({ title: '解绑失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  async viewUserRecords(e) {
    const { openid } = e.currentTarget.dataset
    if (!openid) return
    wx.navigateTo({
      url: `/pages/sign/sign?openid=${openid}`
    })
  },

  onPullDownRefresh() {
    this.loadAllData().finally(() => wx.stopPullDownRefresh())
  }
})