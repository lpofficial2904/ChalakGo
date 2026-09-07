import mongoose from 'mongoose'

const retryDelayMs = 10_000
let retryTimer

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message)
})

export async function connectDatabase() {
  const databaseUri = process.env.MONGODB_STANDARD_URI || process.env.MONGODB_URI

  if (!databaseUri) {
    throw new Error('MongoDB URI is not configured. Add MONGODB_URI or MONGODB_STANDARD_URI to backend/.env.')
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection

  await mongoose.connect(databaseUri)
  console.log(`MongoDB connected: ${mongoose.connection.name}`)
  return mongoose.connection
}

export function connectDatabaseWithRetry() {
  const connect = async () => {
    try {
      await connectDatabase()
      clearTimeout(retryTimer)
    } catch (error) {
      if (error.code === 8000) {
        console.error('MongoDB authentication failed. Check the Database Access user name, password, and read/write role in Atlas.')
        return
      }
      console.error(`MongoDB connection failed: ${error.message}. Retrying in ${retryDelayMs / 1000} seconds.`)
      retryTimer = setTimeout(connect, retryDelayMs)
    }
  }

  connect()
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1
}

export async function disconnectDatabase() {
  clearTimeout(retryTimer)
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
