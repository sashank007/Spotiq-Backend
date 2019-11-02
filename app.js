// app.js
const express = require("express");
const app = express();
const sls = require("serverless-http");
const path = require("path");
const bodyParser = require("body-parser");
const request = require("request");
const querystring = require("querystring");
const MongoClient = require("mongodb").MongoClient;
var Pusher = require("pusher");

const AuthConfig = require("./config");
const redirect_uri = `${AuthConfig.HOST}/callback`;
const client_id = AuthConfig.CLIENT_ID;
const client_secret = AuthConfig.CLIENT_SECRET;

const mongoUser = "sas";
const mongoDbName = "Spotiq";
const mongoPass = "sashank007";
const mongoConnStr = `mongodb+srv://${mongoUser}:${mongoPass}@cluster0-nydon.mongodb.net/${mongoDbName}?retryWrites=true`;

var cors = require("cors");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

var stateKey = "spotify_auth_state";

//mongodb connection

const client = new MongoClient(mongoConnStr, {
  useNewUrlParser: true
});
let db;

var pusher = new Pusher({
  appId: "882030",
  key: "a3ef4965765d2b7fea88",
  secret: "f97e508d15786c2958bd",
  cluster: "us3",
  encrypted: true
});

const createConn = async () => {
  await client.connect();
  db = client.db("Spotiq");
};

app.post("/router", (req, res) => {
  const asyncTrigger = msg => {
    return new Promise((resolve, reject) => {
      pusher.trigger("queue-channel", "queue-item", msg, (err, req, res) => {
        if (err) {
          reject(err);
        }
        resolve(res);
      });
    });
  };

  const pushNotification = async msg => {
    return await asyncTrigger(msg);
  };

  pushNotification({ queue: req.body.queue, privateId: req.body.privateId });
  // channels_client.trigger("queue-channel", "queue-item", {
  //   queue: req.body.queue,
  //   privateId: req.body.privateId
  // });
  return res.json({ success: true, message: "Added item to queue" });
});

const performQueryUpdateUsers = async (privateId, userName, userId) => {
  const users = db.collection("users");

  const newUser = {
    privateId,
    userName,
    userId
  };

  return {
    insertedUser: newUser,
    mongoResult: await users.insertOne(newUser)
  };
};

var generateRandomString = function(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

//Handle the GET endpoint on the root route /
app.get("/", async (req, res, next) => {
  res.status(200).send("Hello Serverless!");
});

//Handle the GET endpoint on the root route /
app.get("/express_backend", async (req, res, next) => {
  res.status(200).send("BACKEND IS RUNNING... REDIRECT URI: ");
});

//add new user to mongodb
app.post("/new_user", async (req, res, next) => {
  let privateId = req.body.privateId;
  let userName = req.body.userName;
  let userId = req.body.userId;

  if (!client.isConnected()) {
    // Cold start or connection timed out. Create new connection.
    try {
      await createConn();
    } catch (e) {
      res.json({
        error: e.message
      });
      return;
    }
  }
  try {
    res.json(await performQueryUpdateUsers(privateId, userName, userId));
    return;
  } catch (e) {
    res.send({
      error: e.message
    });
    return;
  }
});

app.post("/get_user_id", async function(req, res) {
  var id = req.body.privateId;
  if (!client.isConnected()) {
    // Cold start or connection timed out. Create new connection.
    try {
      await createConn();
    } catch (e) {
      res.json({
        error: e.message
      });
      return;
    }
  }

  // Connection ready. Perform insert and return result.
  try {
    const users = db.collection("users");
    const query = { privateId: id };
    users.find(query).toArray((err, result) => {
      res.send({
        search_id: id,
        users: result
      });
    });
    return;
  } catch (e) {
    res.send({
      error: e.message
    });
    return;
  }
});

app.get("/callback", function(req, res) {
  let code = req.query.code || null;
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri,
      grant_type: "authorization_code"
    },
    headers: {
      Authorization:
        "Basic " +
        new Buffer(client_id + ":" + client_secret).toString("base64")
    },
    json: true
  };
  request.post(authOptions, function(error, response, body) {
    var access_token = body.access_token;
    let uri = process.env.FRONTEND_URI || "https://spotiq.netlify.com/";
    // window.localStorage.setItem("access_token", access_token);
    res.redirect(uri + "?access_token=" + access_token);
  });
  // res.status(200).send("Login done");
});

app.get("/login", function(req, res) {
  console.log("loggin in to spotify...");
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = "user-read-playback-state user-modify-playback-state";
  return res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
      })
  );
});

// app.use("/queue", Queue);

module.exports.server = sls(app);
