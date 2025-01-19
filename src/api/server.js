const express = require('express')
const cors = require('cors')
const twilio = require('twilio')
const dotenv = require('dotenv')
const axios = require('axios')
const { GiphyFetch } = require('@giphy/js-fetch-api')

dotenv.config()

const app = express()

// Enable CORS for all origins
app.use(
  cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  })
)

// Handle preflight requests
app.options('*', cors())

app.use(express.json())

// Your Twilio credentials
const authToken = process.env.TWILIO_AUTH_TOKEN
const accountSid = process.env.TWILIO_ACCOUNT_SID
const twilioApiKey = process.env.TWILIO_API_KEY
const twilioApiSecret = process.env.TWILIO_API_SECRET

// Add error handling for missing credentials
if (!accountSid || !authToken || !twilioApiKey || !twilioApiSecret) {
  console.error('Missing Twilio credentials. Please set all required environment variables:')
  console.error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET')
  process.exit(1)
}

const client = twilio(accountSid, authToken)
const AccessToken = twilio.jwt.AccessToken
const VideoGrant = AccessToken.VideoGrant

// Initialize Giphy with API key from environment variables if available
let gf = null
if (process.env.GIPHY_API_KEY) {
  gf = new GiphyFetch(process.env.GIPHY_API_KEY)
  console.log('Giphy API initialized successfully')
} else {
  console.warn('GIPHY_API_KEY not found in environment variables. GIF functionality will be disabled.')
}

app.post('/token', async (req, res) => {
  try {
    const { identity, room } = req.body

    if (!identity || !room) {
      return res.status(400).json({ error: 'Identity and room are required' })
    }

    // Create Video Grant
    const videoGrant = new VideoGrant({
      room: room
    })

    // Create an access token
    const token = new AccessToken(accountSid, twilioApiKey, twilioApiSecret, {
      identity: identity
    })

    // Add the video grant to the token
    token.addGrant(videoGrant)

    // Serialize the token to a JWT string
    res.json({
      token: token.toJwt()
    })
  } catch (error) {
    console.error('Error generating token:', error)
    res.status(500).json({ error: 'Failed to generate token' })
  }
})

// Update GIF endpoints
app.get('/api/gifs/trending', async (req, res) => {
  if (!gf) {
    return res.status(503).json({
      error: 'GIF functionality is disabled. Please set the GIPHY_API_KEY environment variable.'
    })
  }

  try {
    const { offset = 0, limit = 20 } = req.query
    const result = await gf.trending({
      offset: parseInt(offset),
      limit: parseInt(limit),
      rating: 'g'
    })
    res.json(result)
  } catch (error) {
    console.error('Error fetching trending gifs:', error)
    res.status(500).json({ error: 'Failed to fetch trending gifs' })
  }
})

app.get('/api/gifs/search', async (req, res) => {
  if (!gf) {
    return res.status(503).json({
      error: 'GIF functionality is disabled. Please set the GIPHY_API_KEY environment variable.'
    })
  }

  try {
    const { q, offset = 0, limit = 20 } = req.query
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const result = await gf.search(q, {
      offset: parseInt(offset),
      limit: parseInt(limit),
      rating: 'g',
      sort: 'relevant'
    })
    res.json(result)
  } catch (error) {
    console.error('Error searching gifs:', error)
    res.status(500).json({ error: 'Failed to search gifs' })
  }
})

const PORT = process.env.PORT || 3000

// Add error handling for server startup
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log('CORS enabled for all origins')
})
