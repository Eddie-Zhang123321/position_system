import api from './api'

// token存取
const setToken = (token) => wx.setStorageSync('token', token)
const getToken = () => wx.getStorageSync('token')
const clearToken = () => wx.removeStorageSync('token')

// 登录态检查
const isLoggedIn = () => !!getToken()
const checkAuth = () => !!getToken()

// 登录：微信code -> 后端换token -> 缓存
const login = () =>
  new Promise((resolve, reject) => {
    if (isLoggedIn()) {
      resolve({ token: getToken() })
      return
    }

    wx.login({
      success: (res) => {
        if (!res.code) {
          reject(new Error('获取登录凭证失败'))
          return
        }
        api.user
          .login(res.code)
          .then((data) => {
            if (data?.token) {
              setToken(data.token)
            }
            resolve(data)
          })
          .catch((err) => {
            console.error('登录失败', err)
            reject(err)
          })
      },
      fail: (err) => {
        console.error('wx.login失败', err)
        reject(err)
      }
    })
  })

// 获取当前用户信息
const getCurrentUserInfo = () =>
  new Promise((resolve, reject) => {
    api.user
      .getSelfInfo()
      .then((data) => resolve(data))
      .catch((err) => {
        console.error('获取用户信息失败', err)
        reject(err)
      })
  })

// 获取位置信息
const getLocation = () =>
  new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude
        })
      },
      fail: (err) => {
        console.error('获取位置失败', err)
        reject(err)
      }
    })
  })

// 检查是否为管理员
const isAdmin = () =>
  new Promise((resolve, reject) => {
    api.user
      .getSelfInfo()
      .then((data) => resolve(data.role === 'admin'))
      .catch((err) => {
        console.error('检查管理员身份失败', err)
        reject(err)
      })
  })

const auth = {
  setToken,
  getToken,
  clearToken,
  isLoggedIn,
  checkAuth,
  login,
  getCurrentUserInfo,
  getLocation,
  isAdmin
}

export default auth
module.exports = auth
