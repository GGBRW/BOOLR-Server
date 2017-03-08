"use strict";

// File System module
const fs = require("fs");

// Setup websocket server @ port 3000
const WebSocketServer = require("ws").Server,
    wss = new WebSocketServer({ port: 3000 });

let components = [];
let wires = [];

function findComponentByID(id) {
    return components.find(component => component[1].id == id);
}

function findWireByID(id) {
    return wires.find(wire => wire[6] == id);
}

function removeComponent(component) {
    const index = components.indexOf(component);
    index > -1 && components.splice(index,1);
}

function removeWire(wire) {
    const index = wires.indexOf(wire);
    index > -1 && wires.splice(index,1);
}

fs.readFile("server.board","utf8",(err,data) => {
    if(err) return console.log(err);
    if(data) {
        data = JSON.parse(data);

        data.data = JSON.parse(data.data);

        components = data.data[0] || [];
        wires = data.data[1] || [];

        //console.log(components[0][1].output[0].id);
    }
});

wss.on('connection', function(ws) {
    // Send the board to the user
    ws.send(JSON.stringify({
        type: "board",
        data: JSON.stringify([components,wires])
    }));

    // Add the message handler to the user
    ws.on('message', onmessage);

    // Close handler
    ws.on('close', function() {

    });
});

function broadcast(type,data,except) {
    if(!except) except = [];
    wss.clients.forEach(
        client => except.indexOf(client) == -1 && client.send(JSON.stringify({ type, data }))
    );
}

function onmessage(msg) {
    try {
        msg = JSON.parse(msg);
    } catch(e) {
        return;
    }

    const data = JSON.parse(msg.data);
    switch(msg.type) {
        case "add":
            components = components.concat(data[0]);
            wires = wires.concat(data[1]);

            broadcast(
                "add",
                msg.data,
                [this]
            );
            break;
        case "remove":
            console.log(data);

            var component = findComponentByID(data[0]);
            removeComponent(component);

            for(let i = 0; i < data[1].length; ++i) {
                const wire = findWireByID(data[1][i]);
                removeWire(wire);
            }

            broadcast(
                "remove",
                msg.data,
                [this]
            );
            break;
        case "connect":
            var wire = data[0][1][0];
            if(!findWireByID(wire[6])) {
                wires.push(wire);
            }

            broadcast(
                "connect",
                msg.data,
                [this]
            );
            break;
        case "move":
            var component = findComponentByID(data[0]);
            if(component) {
                component[1].pos.x = +data[1];
                component[1].pos.y = +data[2];
            }

            broadcast(
                "move",
                msg.data,
                [this]
            );
            break;
        case "mousedown":
            broadcast(
                "mousedown",
                msg.data,
                [this]
            );
            break;
        case "mouseup":
            broadcast(
                "mouseup",
                msg.data,
                [this]
            );
            break;
    }

}

















