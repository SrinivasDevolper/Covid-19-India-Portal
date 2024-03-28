const express = require('express')
const app = express()
app.use(express.json())
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db
const initalizeDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is Running http://localhost:3000/')
    })
  } catch (e) {
    console.log(`db Error: ${e.message}`)
    process.exit(1)
  }
}
initalizeDb()

//userPost
app.post('/user/', async (request, response) => {
  const {username, password} = request.body
  const userPassBcrypt = await bcrypt.hash(password, 10)
  const getUserDetailsFromDb = `SELECT * FROM user WHERE username='${username}'`
  const userDbResponse = await db.get(getUserDetailsFromDb)
  if (userDbResponse == undefined) {
    const insertNewUser = `INSERT
             INTO
             user(username, password)
             values('${username}', '${userPassBcrypt}')`
    const postUserResponse = await db.run(insertNewUser)
    const userLastDbRes = postUserResponse.lastId
    response.send(`Create new User with ${userLastDbRes}`)
  } else {
    response.status(401)
    response.send('User Already Exits')
  }
})
//userLogin
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userGetRequest = `SELECT * FROM user WHERE username='${username}'`
  const dbResponseFromReq = await db.get(userGetRequest)
  if (dbResponseFromReq === undefined) {
    response.status(400)
    response.send('Invalid User')
  } else {
    compareUserPassword = await bcrypt.compare(
      password,
      dbResponseFromReq.password,
    )
    if (compareUserPassword == true) {
      const payload = {username: username}
      const jwtTokenGen = jwt.sign(payload, 'My_secret_Token')
      response.send({jwtTokenGen})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

const authentication = async (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (authHeader == undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'My_secret_Token', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authentication, async (request, response) => {
  const getDataFromstate = `SELECT state_id as stateId, state_name as stateName, population FROM state ORDER BY state_id`
  const getResponseFromData = await db.all(getDataFromstate)
  response.send(getResponseFromData)
})

app.get('/states/:stateId/', authentication, async (request, response) => {
  const {stateId} = request.params
  const getRequsetFromDataId = `SELECT state_id as stateId, state_name as stateName, population FROM state WHERE state_id=${stateId};`
  const getResponseFromDataId = await db.get(getRequsetFromDataId)
  response.send(getResponseFromDataId)
})

app.post('/districts/', authentication, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postRequestToData = `
  INSERT
  INTO
  district(district_name, state_id, cases, cured, active, deaths)
  VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`
  const responseFromPostData = await db.run(postRequestToData)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const getRequsetFromDataId = `SELECT 
    district_id as districtId, district_name as districtName, state_id as stateId, cases, cured, active, deaths 
    FROM
    district
    NATURAL JOIN
    state 
    WHERE district_id=${districtId};`
    const getResponseFromDataId = await db.get(getRequsetFromDataId)
    response.send(getResponseFromDataId)
  },
)

app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteFromData = `DELETE FROM district WHERE district_id=${districtId}`
    const deleteDbresponse = await db.run(deleteFromData)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const putDataFromDb = `UPDATE district SET district_name='${districtName}', state_id=${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths} WHERE district_id=${districtId}`
    const responseDbToData = await db.run(putDataFromDb)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params
    const getResponseFromDb = `SELECT sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths FROM district WHERE state_id=${stateId}`
    response.send(await db.get(getResponseFromDb))
  },
)

module.exports = app
