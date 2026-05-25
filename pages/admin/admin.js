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
    activeTab: 'online', // 'online' 实时在线, 'duration' 在线时长, 'seats' 座位管理, 'records' 签到记录
    tables: [],
    users: [],
    onlineUsers: [], // 实时在线用户
    durationList: [], // 在线时长列表
    records: [],
    showAllQRCodes: false, // 是否显示所有二维码弹窗
    qrCodes: [], // 所有座位的二维码列表
    loadingQRCodes: false // 加载二维码中
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
    try {
      const [tables, users, records] = await Promise.all([
        api.table.getAllTables(),
        api.user.getAllUsers(),
        api.sign.getAllRecords()
      ])
      
      // 筛选在线用户（用于统计）
      const onlineUsers = (users || []).filter(u => u.is_online === true)
      
      // 所有用户按座位号排序（用于实时在线显示）
      const sortedUsers = (users || []).sort((a, b) => {
        // 按 table_id 排序，null 或 undefined 排在最后
        const aId = a.table_id || 999999
        const bId = b.table_id || 999999
        return aId - bId
      })
      
      // 为座位数据关联用户信息
      const tablesWithUser = (tables || []).map(table => {
        if (table.bind_user_openid) {
          // 查找绑定的用户信息
          const bindUser = (users || []).find(u => u.openid === table.bind_user_openid)
          // 优先使用从 users 数组中找到的用户名称，其次使用 table.bind_user，最后使用默认值
          const userName = bindUser 
            ? (bindUser.name || bindUser.nickname || '未命名')
            : (table.bind_user || '未知用户')
          
          return {
            ...table,
            bindUserName: userName,
            bindUserOnline: bindUser ? (bindUser.is_online || false) : false
          }
        }
        return {
          ...table,
          bindUserName: null,
          bindUserOnline: false
        }
      })
      
      // 计算一周前的日期
      const oneWeekAgo = this.getOneWeekAgoDate()
      
      // 加载在线时长数据
      let durationList = []
      try {
        const rawList = await api.sign.getOnlineDuration(oneWeekAgo) || []
        console.log('在线时长原始数据:', rawList)
        // 格式化时长显示并按时长降序排序
        // 如果后端返回的数据中没有 openid，尝试从 users 数组中通过 table_id 查找
        durationList = rawList
          .map(item => {
            // 如果数据中没有 openid，尝试从 users 数组中查找
            let openid = item.openid
            if (!openid && item.table_id) {
              const user = (users || []).find(u => u.table_id === item.table_id)
              if (user) {
                openid = user.openid
                console.log(`通过 table_id ${item.table_id} 找到用户 openid:`, openid)
              }
            }
            const result = {
              ...item,
              openid: openid || item.openid, // 确保有 openid
              durationText: this.formatDuration(item.duration_seconds)
            }
            console.log('处理后的在线时长项:', result)
            return result
          })
          .sort((a, b) => b.duration_seconds - a.duration_seconds)
        console.log('最终在线时长列表:', durationList)
      } catch (err) {
        console.warn('加载在线时长失败', err)
      }
      
      // 统计：已绑定座位数（有 bind_user_openid 的座位）
      const boundSeatCount = (tables || []).filter(t => t.bind_user_openid).length

      this.setData({
        tables: tablesWithUser,  // 使用关联了用户信息的座位列表
        users: sortedUsers,  // 使用排序后的用户列表
        onlineUsers: onlineUsers,
        onlineCount: onlineUsers.length,
        boundSeatCount: boundSeatCount,
        durationList: durationList,
        records: (records || []).map(r => ({ ...r, sign_in_time: formatRecordTime(r.sign_in_time) })),
        isLoading: false
      })
    } catch (err) {
      console.error('加载数据失败', err)
      this.setData({ isLoading: false })
    }
  },

  // 获取一周前的日期（格式：YYYY-MM-DD）
  getOneWeekAgoDate: function() {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 格式化时长（秒转小时分钟）
  formatDuration: function(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  },

  // 切换标签页
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    // 切换标签时刷新数据
    if (tab === 'duration') {
      this.loadDurationData()
    } else {
      this.loadAllData()
    }
  },

  // 单独加载在线时长数据
  async loadDurationData() {
    try {
      const oneWeekAgo = this.getOneWeekAgoDate()
      const rawList = await api.sign.getOnlineDuration(oneWeekAgo) || []
      const users = this.data.users || []
      
      // 格式化时长显示并按时长降序排序
      // 如果后端返回的数据中没有 openid，尝试从 users 数组中通过 table_id 查找
      const formattedList = rawList
        .map(item => {
          // 如果数据中没有 openid，尝试从 users 数组中查找
          let openid = item.openid
          if (!openid && item.table_id) {
            const user = users.find(u => u.table_id === item.table_id)
            if (user) {
              openid = user.openid
            }
          }
          return {
            ...item,
            openid: openid || item.openid, // 确保有 openid
            durationText: this.formatDuration(item.duration_seconds)
          }
        })
        .sort((a, b) => b.duration_seconds - a.duration_seconds)
      this.setData({ durationList: formattedList })
    } catch (err) {
      console.error('加载在线时长失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
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

  // 查看用户签到记录（从在线时长点击）
  viewUserSignRecords(e) {
    console.log('viewUserSignRecords 被调用', e)
    const openid = e.currentTarget.dataset.openid || e.detail?.openid
    console.log('点击查看用户签到记录，openid:', openid, '完整 dataset:', e.currentTarget.dataset)
    
    if (!openid) {
      console.error('openid 为空，无法跳转')
      wx.showToast({ title: '用户信息缺失', icon: 'none' })
      return
    }
    
    // 将 openid 存储到全局数据中（因为 tabBar 页面不能通过 URL 参数传递）
    const app = getApp()
    app.globalData.viewUserOpenid = openid
    
    console.log('准备跳转到签到页面，openid:', openid)
    wx.switchTab({
      url: '/pages/sign/sign',
      success: () => {
        console.log('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败', err)
        wx.showToast({ title: '跳转失败', icon: 'none' })
      }
    })
  },

  // 导出所有二维码
  async exportAllQRCodes() {
    if (this.data.tables.length === 0) {
      wx.showToast({ title: '暂无座位', icon: 'none' })
      return
    }

    this.setData({ loadingQRCodes: true, showAllQRCodes: true, qrCodes: [] })

    try {
      // 批量获取所有座位的二维码
      const qrPromises = this.data.tables.map(async (table) => {
        try {
          const res = await api.table.getQRCode(table.id)
          const base64 = wx.arrayBufferToBase64(res)
          const img = `data:image/png;base64,${base64}`
          return {
            id: table.id,
            qrImage: img
          }
        } catch (err) {
          console.error(`获取座位 ${table.id} 二维码失败`, err)
          return {
            id: table.id,
            qrImage: null,
            error: true
          }
        }
      })

      const qrCodes = await Promise.all(qrPromises)
      this.setData({ qrCodes, loadingQRCodes: false })
    } catch (err) {
      console.error('批量获取二维码失败', err)
      this.setData({ loadingQRCodes: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 关闭二维码弹窗
  closeAllQRCodes() {
    this.setData({ showAllQRCodes: false, qrCodes: [] })
  },

  // 预览单个二维码（可保存到相册）
  previewQRCode(e) {
    const { id, image } = e.currentTarget.dataset
    if (!image) {
      wx.showToast({ title: '二维码加载失败', icon: 'none' })
      return
    }

    // 预览图片
    wx.previewImage({
      urls: [image],
      current: image,
      success: () => {
        // 提示可以长按保存
        setTimeout(() => {
          wx.showToast({
            title: '长按图片可保存',
            icon: 'none',
            duration: 2000
          })
        }, 500)
      }
    })
  },

  // 保存单个二维码到相册
  saveQRCodeToAlbum(e) {
    const { id, image } = e.currentTarget.dataset
    if (!image) {
      wx.showToast({ title: '二维码加载失败', icon: 'none' })
      return
    }

    // 先下载图片到本地
    wx.downloadFile({
      url: image,
      success: (res) => {
        if (res.statusCode === 200) {
          // 保存到相册
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({
                title: '已保存到相册',
                icon: 'success'
              })
            },
            fail: (err) => {
              if (err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '需要授权',
                  content: '需要您授权保存图片到相册',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.openSetting()
                    }
                  }
                })
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' })
              }
            }
          })
        }
      },
      fail: () => {
        wx.showToast({ title: '下载失败', icon: 'none' })
      }
    })
  },

  onPullDownRefresh() {
    this.loadAllData().finally(() => wx.stopPullDownRefresh())
  }
})