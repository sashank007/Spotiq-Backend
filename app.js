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
var socket = require("socket.io");

// var server_ = require("http").createServer(app);
var port = process.env.PORT || 5000;

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

//pusher credentials
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

const pushNotification = async msg => {
  return await asyncTrigger(msg);
};

const asyncTrigger = msg => {
  console.log("asyn trigger...");
  return new Promise((resolve, reject) => {
    pusher.trigger("queue-channel", "queue-item", msg, (err, req, res) => {
      if (err) {
        reject(err);
      }
      resolve(res);
    });
  });
};

app.post("/queue", (req, res) => {
  // pushNotification({ queue: req.body.queue, privateId: req.body.privateId });

  return res.json({ success: true, message: "Added item to queue" });
});

const performQueryUpdateUsers = async (privateId, userName, userId, points) => {
  const users = db.collection("users");

  const newUser = {
    privateId,
    userName,
    userId,
    points
  };

  return {
    insertedUser: newUser,
    mongoResult: await users.insertOne(newUser)
  };
};

const performQueryUpdateQueues = async (privateId, queue, master) => {
  const queues = db.collection("queues");

  const newQueue = {
    privateId,
    queue,
    master
  };

  return {
    insertedQueue: newQueue,
    mongoResult: await queues.insertOne(newQueue)
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
  res.status(200).send("Welcome to SpotiQ!");
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
  let points = req.body.points;

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
    res.json(
      await performQueryUpdateUsers(privateId, userName, userId, points)
    );
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

app.post("/update_user", async function(req, res) {
  var privateId = req.body.privateId;
  var userId = req.body.userId;
  var new_points = req.body.points;
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
    const query = { privateId: privateId, userId: userId };

    //set new value
    var newvalues = { $set: { points: parseInt(new_points) } };
    console.log("query: ", query);
    //update one
    users.updateOne(query, newvalues, function(err, res) {
      if (err) throw err;
      console.log("1 document updated");
    });
    res.send({ status: 200, message: "Succesfully updated" });
  } catch (e) {
    res.send({
      error: e.message
    });
    return;
  }
});

app.post("/get_user_by_id", async function(req, res) {
  let privateId = req.body.privateId;
  var userId = req.body.playerId;
  console.log("body for get user: ", req.body);
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
    const query = { userId: userId, privateId: privateId };
    console.log("query for points: ", query);
    users.find(query).toArray((err, result) => {
      console.log("points data for indiv user : ", result);
      res.send({
        search_id: privateId,
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

app.post("/update_queue", async function(req, res) {
  var id = req.body.privateId;
  var queue = req.body.queue;
  var master = req.body.master;

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
    const queues = db.collection("queues");
    const query = { privateId: id };
    var newvalues = {};
    if (master !== "") newvalues = { $set: { master: master } };
    //set new value
    else newvalues = { $set: { queue: queue } };

    //check if there is existing queue
    queues.find(query).toArray(async (err, result) => {
      if (result.length > 0) {
        //update the queue
        queues.updateOne(query, newvalues, function(err, res) {
          if (err) throw err;
        });
      } else {
        //create new queue
        res.json(await performQueryUpdateQueues(id, queue, master));
      }
      res.send({
        search_id: id,
        queues: result
      });
    });

    //update one

    return;
  } catch (e) {
    res.send({
      error: e.message
    });
    return;
  }
});

app.post("/get_queue", async function(req, res) {
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
    const queues = db.collection("queues");
    const query = { privateId: id };
    queues.find(query).toArray((err, result) => {
      console.log("result for queues: ", result);
      res.send({
        search_id: id,
        queues: result
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

module.exports.server = sls(app);
