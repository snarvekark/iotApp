const express = require('express');
const path = require('path');                       //for path navigation
const bodyParser = require('body-parser');          //to access at req.value
const methodOverride = require('method-override');  //needs for edit and delete
const {PubSub} = require('@google-cloud/pubsub');   //google cloud pub/sub module
const mongoose = require('mongoose');               //database
const exphbs = require('express-handlebars');       //front-end

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

//load values model
require('./models/Value');
const Values = mongoose.model('values');
require('./models/Accel_cloud');
const AccelCloud = mongoose.model('accel_cloud');
require('./models/Accel_edge');
const AccelEdge = mongoose.model('accel_edge');

//handlebars helpers
const {stripTags} = require('./helpers/hbs');
const {eq} = require('./helpers/hbs');




/********************************************************************************************************/
/*                                    WebSocket and MQTT connection                                     */
/********************************************************************************************************/

function predict(x, y, z){
  let magnitude = Math.hypot(x, y, z);
  if(magnitude > 9.05 && magnitude < 9.95) return 1;
  else return 0;
}


//Authenticate Default Connection *****************************
// Imports the Google Cloud client library.
const {Storage} = require('@google-cloud/storage');

// Instantiates a client. If you don't specify credentials when constructing
// the client, the client library will look for credentials in the
// environment.
const storage = new Storage();
// Makes an authenticated API request.
async function listBuckets() {
  try {
    const results = await storage.getBuckets();

    const [buckets] = results;

    console.log('Buckets:');
    buckets.forEach((bucket) => {
      console.log(bucket.name);
    });
  } catch (err) {
    console.error('ERROR:', err);
  }
}
listBuckets();

//************** End of Authentication */

// Imports the Google Cloud client library
io.on('connection', function(socket){
  var values = io.emit("lastvalues", values);
 

  const subscriptionName1 = 'projects/assignment1-291402/subscriptions/my-subscription';
  
  // Creates a client; cache this for further use
  const pubSubClient = new PubSub();

  function listenForMessages() {
    // References an existing subscription
    const subscription1 = pubSubClient.subscription(subscriptionName1);
   
    // Create an event handler to handle messages

    const messageHandler1 = message => {
      console.log(`Received message ${message.id}:`);
      console.log(`\tData: ${message.data}`);
      //console.log(`\tAttributes: ${message.attributes}`);
      // Splitting the payload received
      var payload = `${message.data}`.split(";");
      
      // Insert the new value in the Database
      const newValue = {
        deviceId: payload[0].toString(),
        value: payload[1].toString(),
        date: payload[2].toString()
      };
      new Values(newValue).save();

      // TEMPERATURE
      io.emit("temperature", payload[1]+";"+payload[2]);
      message.ack();
    };

    // Listen for new messages until timeout is hit
    subscription1.on('message', messageHandler1);
  }
  listenForMessages();
});
/***********************************************************************************************************************/

//handlebars middleware
app.engine('handlebars', exphbs({
  helpers: {stripTags: stripTags, eq:eq },
  defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

//body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

//method override middleware
app.use(methodOverride('_method'));

// Map global promise - get rid of warning
mongoose.Promise = global.Promise;
//connect to mongoose
const uri = "mongodb+srv://iotUser1:GweMPb6FHdYf9TFr@cluster0.lcqe6.gcp.mongodb.net/iotUser1?retryWrites=true&w=majority";
mongoose.connect(uri, {
  useNewUrlParser: true
})
  .then(() => {
    console.log('MongoDb Connected..');
  })
  .catch(err => console.log(err));

// GET route for index page
app.get('/', function (req, res) {
  // Query to retrieve the last hour values
  Values.find(
    { date: { $gt: parseInt(Date.now()/1000) - 3600 } }
  ).then(values =>{
    res.render('index', {values:values});
  })
});

// Starting Server
const port = process.env.PORT || 5000;
http.listen(port, ()=>{
  console.log(`Server started on port ${port}`);
} );

