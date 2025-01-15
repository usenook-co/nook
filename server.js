const express = require("express")
const cors = require("cors")
const twilio = require("twilio")
const dotenv = require("dotenv")

dotenv.config()

const app = express()

// Enable CORS for all origins
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
)

// Handle preflight requests
app.options("*", cors())

app.use(express.json())

// Your Twilio credentials
const authToken = process.env.TWILIO_AUTH_TOKEN
const accountSid = process.env.TWILIO_ACCOUNT_SID
const twilioApiKey = process.env.TWILIO_API_KEY
const twilioApiSecret = process.env.TWILIO_API_SECRET

// Add error handling for missing credentials
if (!accountSid || !authToken || !twilioApiKey || !twilioApiSecret) {
  console.error(
    "Missing Twilio credentials. Please set all required environment variables:"
  )
  console.error(
    "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET"
  )
  process.exit(1)
}

const client = twilio(accountSid, authToken)
const AccessToken = twilio.jwt.AccessToken
const VideoGrant = AccessToken.VideoGrant

app.post("/token", async (req, res) => {
  try {
    const { identity, room } = req.body

    if (!identity || !room) {
      return res.status(400).json({ error: "Identity and room are required" })
    }

    // Create Video Grant
    const videoGrant = new VideoGrant({
      room: room,
    })

    // Create an access token
    const token = new AccessToken(accountSid, twilioApiKey, twilioApiSecret, {
      identity: identity,
    })

    // Add the video grant to the token
    token.addGrant(videoGrant)

    // Serialize the token to a JWT string
    res.json({
      token: token.toJwt(),
    })
  } catch (error) {
    console.error("Error generating token:", error)
    res.status(500).json({ error: "Failed to generate token" })
  }
})

const PORT = process.env.PORT || 3000

// Add error handling for server startup
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log("CORS enabled for all origins")
})
