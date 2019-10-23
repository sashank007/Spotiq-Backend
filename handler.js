// app.js
const express = require("express");
const app = express();
const sls = require("serverless-http");
const path = require("path");
const bodyParser = require("body-parser");
const request = require("request");
const querystring = require("querystring");
const express = require("express");

const AuthConfig = require("./config");
const redirect_uri = `${AuthConfig.HOST}/callback`;
const client_id = AuthConfig.CLIENT_ID;
const client_secret = AuthConfig.CLIENT_SECRET;
const Queue = require("./queue");

var cors = require("cors");
var app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.use("/queue", Queue);

var stateKey = "spotify_auth_state";

var generateRandomString = function(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// app.get("/express_backend", async (req, res) => {
//   res.status(200).send("Hello Humans!");
// });

//Handle the GET endpoint on the root route /
app.get("/express_backend", async (req, res, next) => {
  res.status(200).send("Hello Serverless!");
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
    let uri = process.env.FRONTEND_URI || "http://localhost:3000";
    res.redirect(uri + "?access_token=" + access_token);
  });
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

module.exports.server = sls(app);
