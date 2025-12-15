// API请求基础配置
const baseUrl = 'http://8.133.203.53:3608/v1/api'

// 统一请求封装：自动附加token，处理错误提示
const request = (url, method = 'GET', data = {}, extraHeader = {}) => {
  const { responseType, ...restHeader } = extraHeader
  const token = wx.getStorageSync('token')
  const header = {
    'content-type': 'application/json',
    ...restHeader
  }
  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${url}`,
      method,
      data,
      header,
      responseType,
      success: (res) => {
        // 2xx 视为成功
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          // 统一错误提示
          wx.showToast({
            title: res.data?.message || '请求失败',
            icon: 'none',
            duration: 2000
          })
          reject(res)
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络异常，请稍后重试',
          icon: 'none',
          duration: 2000
        })
        reject(err)
      }
    })
  })
}

// 简化GET/POST调用
const get = (url, params = {}, header = {}) => request(url, 'GET', params, header)
const post = (url, data = {}, header = {}) => request(url, 'POST', data, header)

// API接口集合
const api = {
  // 用户相关
  user: {
    // 登录
    login: (code) => post('/user/login', { code }),
    // 设置用户名
    setName: (name) => post('/user/set_name', { name }),
    // 获取当前用户信息
    getSelfInfo: () => get('/user/info/self'),
    // 获取所有用户信息（管理员）
    getAllUsers: () => get('/user/info'),
    // 获取指定用户信息（管理员）
    getUserInfo: (openid) => get(`/user/info/${openid}`)
  },

  // 座位相关
  table: {
    // 获取所有桌子信息
    getAllTables: () => get('/table/all'),
    // 绑定桌子
    bind: (openid, tableId) => post('/table/bind', { openid, table_id: tableId }),
    // 解绑桌子
    unbind: (openid) => post('/table/unbind', { openid }),
    // 创建桌子（管理员）
    create: () => post('/table/create'),
    // 获取桌子二维码
    getQRCode: (id) =>
      request(`/table/qrcode/${id}`, 'GET', {}, {
        Accept: 'image/png',
        responseType: 'arraybuffer'
      })
  },

  // 签到相关
  sign: {
    // 签到
    signIn: (token, address, latitude, longitude) =>
      post('/sign/in', { token, address, latitude, longitude }),
    // 获取当前用户签到记录
    getRecords: () => get('/sign/records'),
    // 获取指定用户签到记录（管理员）
    getUserRecords: (openid) => get(`/sign/records/${openid}`),
    // 获取所有用户签到记录（管理员）
    getAllRecords: () => get('/sign/records_all')
  }
}

export default api
