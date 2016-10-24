"use strict";
const request = require('request')
const app = require('koa')()
const router = require('koa-router')()
const send = require('koa-send')
const json = require('koa-json')
const moment = require('moment')

const port = 3000
const ticketQuantity = 1
const ticketDate = moment("2016-10-25T15:00:00Z", moment.ISO_8601);
//const ticketDate = moment("2016-10-24T18:00:00Z", moment.ISO_8601);
const minutesBefore = 4;
const startPoll = ticketDate.clone().subtract(minutesBefore, 'minutes');

function findAll(data, s) {
	let rx = new RegExp(s, "g");
	let matches = new Array();
	let match;
	while ((match = rx.exec(data)) !== null) {
		matches.push(match);
	}
	return matches;
}

let payload = {
	status: "waiting",
	timeLeft: ""
}
let isUpdating = false;

function update() {
	let diff = startPoll.diff(moment());
	if(diff > 0) { // Don't update yet, we haven't reached startPoll time
		isUpdating = false;
		//console.log("Will start updating " + moment.duration(diff).humanize(true));
		payload = {
			status: "waiting",
			timeLeft: moment.duration(diff).humanize(true)
		}
		return;
	}

	//console.log("Updating...");
	payload = {
		status: "polling"
	}
	isUpdating = true;
	request({
	    method: 'GET',
	    //url: 'https://www.eventbrite.co.uk/e/repair-cafe-tickets-27780488188'
			//url: 'https://www.eventbrite.co.uk/e/raspberry-pi-coding-workshop-tickets-27780640644'
			url: 'https://www.eventbrite.co.uk/e/hackkings-30-tickets-28376671388'
	}, function(err, response, body) {
	    if (err) return console.error(err);

			let publicId = findAll(body, "public_id\":([^,]+),");
	    let ticketMatches = findAll(body, "ticket_form_element_name\":\"([^\"]+)\"");
			let quantityMatches = findAll(body, "quantity_remaining\":([^,]+),");
			let ticketNames = findAll(body, "ticket_name\":\"([^\"]+)\"");

			for(var i = 0; i < ticketMatches.length; i++) {
				let name = ticketNames[i][1].toLowerCase();
				if(parseInt(quantityMatches[i][1]) <= 0
				|| name.indexOf("child") != -1
				|| name.indexOf("16") != -1
				|| name.indexOf("17") != -1) continue;
				//console.log("Ticket found, updating payload for clients");
				payload = {
					status: "available",
					eid: publicId[i][1],
					remaining: quantityMatches[i][1],
					ticketName: ticketMatches[i][1]
				}
				break;
			}
	});
}

router.get('/', function *(){
  yield send(this, 'index.html', { root: __dirname + '/public' })
})

router.get('/payload', function *(){
  this.body = payload || {};
})

setInterval(update, 1000);

app.use(function *(next){
  var start = new Date;
  yield next;
  var ms = new Date - start;
	var timestamp = start.toISOString().replace(/T/, ' ').replace(/\..+/, '');
	if(this.url != "/payload")
  	console.log('%s [%s]: %s %s - %sms', this.request.ip, timestamp, this.method, this.url, ms);
}).use(json())
	.use(router.routes())
	.use(router.allowedMethods());
app.listen(port)
