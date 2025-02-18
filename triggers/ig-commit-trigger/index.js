var secret = require('./secret.json');
var job = require('./job.json');
var decode = require('base-64').decode;
var Api = require('kubernetes-client');

var config = {
  url: 'https://' + secret.clusterIp,
  ca: decode(secret.data['ca.crt']),
  auth: {
    bearer: decode(secret.data.token)
  }
};

const core = new Api.Core(config);
const batch = new Api.Batch(config);

function print(err, result) {
  console.log(JSON.stringify(err || result, null, 2));
}

exports["ig-commit-trigger"] = function(req, res) {

  res.header("Access-Control-Allow-Method", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Origin", "*");

  if (req.method === 'OPTIONS') {
    res.status(200);
    res.json({})
    return;
  }

  console.log("BODY 2", req.body);
  var target = req.body.repository.full_name.split('/');
  var org = target[0];
  var repo = target[1];
  var branch;
  try {
    branch = req.body.ref.split('/').slice(-1)[0];
  } catch(error) {
    console.err("No branch specified in trigger!");
    throw(error);
  }

  console.log("JOB", job);

  job.spec.template.spec.containers[0].env = [{
      "name": "PUBLISHER_JAR_URL",
      "value": "https://github.com/HL7/fhir-ig-publisher/releases/latest/download/publisher.jar"
    },
    {
      "name": "IG_ORG",
      "value":org
    }, {
      "name": "IG_REPO",
      "value": repo
    }, {
      "name": "IG_BRANCH",
      "value": branch
    }, {
      "name": "TX_SERVER_URL",
      "value": "http://tx.fhir.org/r4"
    }, {
      "name": "ZULIP_EMAIL",
      "value": secret.zulip_email
    }, {
      "name": "ZULIP_API_KEY",
      "value": secret.zulip_api_key
    }, {
      "name": "DEADLINE_SECONDS",
      "value": "36000",
    }, {
      "name": "JAVA_MEMORY",
      "value": "19000m"
  }];

  batch.ns('fhir').jobs.post({body: job}, function(err, submitted){
    console.log("ERR", JSON.stringify(err))
    console.log("RES", JSON.stringify(submitted, null,2))
    res && res.status(200).json({
      'org': org,
      'repo': repo,
      'branch': branch
      // 'submitted': submitted
    });
  })

};
