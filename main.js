"use strict";

// File System module
const fs = require("fs");

// Setup websocket server @ port 3000
const WebSocketServer = require("ws").Server,
      wss = new WebSocketServer({ port: 3000 });

// The list of all the users identified by their user agent
// OMG this is so safe
let accounts = {
    "GGBRW": { username: "GGBRW", password: "Moeten ze er maar geen centerparks b0uwen", online: false, color: "#005" },
    "Bakker Joop": { username: "Bakker Joop", password: "Spijkertje4", online: false, color: "#500" },
    "Toine": { username: "Toine", password: "Moeder is op zakenreis", online: false, color: "#050" },
    "test": { username: "test", password: "test", online: false, color: "#305" }
}

let spectators = {};

// All the components are stored in the following array:
let components = [];

// All the connections between the components are stored in the following array:
let connections = [];

fs.readFile("server.board","utf8",(err,data) => {
    if(err) return console.log(err);
    if(data) {
        components = JSON.parse(data);
    }
});

wss.on('connection', function(ws) {
    // Something tries to connect to this server

    // Get the user agent of the thing that tries to connect
    const userAgent = ws.upgradeReq.headers["user-agent"];

    if(!ws.user) {
        // If the user hasn't connected once before, send a login request
        ws.send(JSON.stringify({
            type: "loginRequest"
        }));
    }

    // Add the message handler to the user
    ws.on('message', onmessage);

    ws.on('close', function() {
        if(this.user) {
            this.user.online = false;
        } else if(spectators[userAgent]) {
            broadcast(
                "notification",
                "A spectator left the server"
            );

            delete spectators[userAgent];
        }

        // Send user data to the user
        broadcast(
            "users",
            { you: this.user, accounts, spectators: Object.keys(spectators).length }
        );
    });
});

function broadcast(type,data,except) {
    if(!except) except = [];
    wss.clients.forEach(
        client => except.indexOf(client) == -1 && client.send(JSON.stringify({ type, data }))
    );
}

function onmessage(msg) {
    // The message must be a JSON string, otherwise the function will return 'undefined'
    try {
        msg = JSON.parse(msg);
    } catch(e) {
        return;
    }

    // Get the user agent of the sender
    const userAgent = this.upgradeReq.headers["user-agent"];

    if(!this.user) {
        // If the sender hasn't connected once before, the server will only accept a identifying message
        if(msg.type == "login") {
            if(msg.data.username == "spectator") {
                spectators[userAgent] = {};
                broadcast("notification", "A spectator joined the server");

                // Send user data to the user
                broadcast(
                    "users",
                    { you: this.user, accounts, spectators: Object.keys(spectators).length }
                );
                return;
            }

            const account = accounts[msg.data.username];
            if(account && account.password == msg.data.password) {
                this.user = account;
                this.user.online = true;

                // Send user data to the user
                broadcast(
                    "users",
                    { you: this.user, accounts, spectators: spectators.length }
                );

                // Send the map to the user
                this.send(JSON.stringify({
                    type: "map",
                    data: JSON.stringify([components.map(n => [n[0],n[1]]),connections])
                }));
            } else {
                this.send(JSON.stringify({
                    type: "loginRequest",
                    data: "wrong"
                }));
            }
        } else {
            this.send(JSON.stringify({
                type: "loginRequest"
            }));
        }
    } else {
        // Switch the message types
        switch(msg.type) {
            case "chat":
                broadcast(
                    "chat", {
                    from: this.user.username,
                    msg: msg.data
                });
                break;
            case "action":
                const action = msg.data;
                action.from = this.user.username;

                let data = action.socketData;
                switch(action.type) {
                    case "add":
                        const parsed = JSON.parse(data);
                        const constructor = parsed[0][0][0];
                        const properties = parsed[0][0][1];
                        properties.placedBy = this.user.username;
                        components.push([constructor,properties]);

                        action.socketData = JSON.parse(action.socketData);
                        action.socketData[0][0][1].placedBy = this.user.username;
                        action.socketData = JSON.stringify(action.socketData);
                        break;
                    case "remove":
                        const index = +data.substr(2);
                        components.splice(index,1);
                        connections.map((n,i) => i > index && n.map(m => ++m));
                        break;
                    case "removeSelection":
                        for(let i = 0; i < data.length; ++i) {
                            const index = +data[i].substr(2);
                            components.splice(index,1);
                            connections.map((n,i) => i > index && n.map(m => ++m));
                        }
                        break;
                    case "connect":
                        connections.push([+data[0].substr(2),+data[1].substr(2),-1]);
                        connections = connections.map(n => n.map(m => ++m));

                        const parsedWire = JSON.parse(data[2]);
                        components.unshift([parsedWire[0][0][0],parsedWire[0][0][1]]);
                        break;
                }

                broadcast(
                  "action",
                    action,
                    [this]
                );
                break;
        }
    }
}

console.log("Server is running...");