var http = require('http');

var io;



var port = process.env.port || 80;//1337
var fs = require('fs');
var sql = require('mssql');
var Connection = require('tedious').Connection;
var configData = [];
var Cookies = require('cookies');
var userid = 0;
//Google OAuth start
var google = require('googleapis');
var GoogleAuth = require('google-auth-library');
var auth = new GoogleAuth;
// Client ID and client secret are available at
// https://code.google.com/apis/console
var CLIENT_ID = "1001265425988-8ivs9qke3nma902gs6pain9sqpgqiq4j.apps.googleusercontent.com";
var REDIRECT_URL = "http://localhost:1337";
var token = 0;
var client = new auth.OAuth2(CLIENT_ID, '', '');
var googleUserId = 0;
var readline = require('readline');
var plus = google.plus('v1');
var OAuth2 = google.auth.OAuth2;
var oauth2Client = new OAuth2(
    CLIENT_ID,
    REDIRECT_URL
);
var totalActiveConnections = 0;
plus.people.get({
    userId: 'me',
    auth: oauth2Client
}, function (err, response) {
    // handle err and response
    if (!err) {

        console.log('goog reps');
        console.log(response);
    }
});




var connectionConfig = {
    //userName: 'knockAppUser',
    userName: process.env.dbuserName,//configData[2],
    password: process.env.dbPassword,//configData[3],
    server: 'knockappserver.database.windows.net',
    // If you are on Microsoft Azure, you need this:  
    options: { encrypt: true, database: 'knockAppDB' }
};

var connection = new Connection(connectionConfig);
var ConnectionPool = require('tedious-connection-pool');//this one is for handling multiple requests on one connection
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

var poolConfig = {
    min: 2,
    max: 20,
    log: true
};
//var connectionConfig = {
//    userName: 'login',
//    password: 'password',
//    server: 'localhost'
//};

//create the pool
var pool = new ConnectionPool(poolConfig, connectionConfig);
pool.on('error', function (err) {
    console.error("Tedious connection pool error: " + err);
});
connection.on('connect', function (err) {
    server.listen(port);
    console.log('connecting to DB: ' + err);
});
function createTaskDB(data, res) {
    pool.acquire(function (err, connection) {
        request = new Request(
            "USE knockAppDB INSERT INTO Tasks (Name, InitialStart, LastStart, TotalTime, Hours, Minutes, Seconds, TimerOn, googleUserId) OUTPUT INSERTED.Id VALUES ( @Name, @InitialStart, @LastStart, @TotalTime, @Hours, @Minutes, @Seconds, @TimerOn, @googleUserId);",
            function (err) {
                //request = new Request(sqlQ, function (err) {
                if (err) {
                    console.log("en error during insertion: " + err);
                }
            });
        request.addParameter('Name', TYPES.NVarChar, data['Name']);
        request.addParameter('InitialStart', TYPES.BigInt, data['InitialStart']);
        request.addParameter('LastStart', TYPES.BigInt, data['LastStart']);
        request.addParameter('TotalTime', TYPES.BigInt, data['TotalTime']);
        request.addParameter('Hours', TYPES.BigInt, data['Hours']);
        request.addParameter('Minutes', TYPES.BigInt, data['Minutes']);
        request.addParameter('Seconds', TYPES.BigInt, data['Seconds']);
        request.addParameter('TimerOn', TYPES.Bit, data['TimerOn']);
        request.addParameter('googleUserId', TYPES.BigInt, googleUserId);

        var insertedID;
        request.on('row', function (columns) {
            insertedID = columns[0].value;

        });
        request.on('doneProc', function (rowCount, more, returnStatus, rows) {
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify(insertedID));
            res.end();
            connection.release();

        });
        connection.execSql(request);
    });

}
function deleteTaskDB(id) {
    pool.acquire(function (err, connection) {
        request = new Request(
            "USE knockAppDB DELETE FROM Tasks WHERE Id = @id;",
            function (err) {
                if (err) {
                    console.log(err);
                }
            });
        request.addParameter('Id', TYPES.Int, id);
        connection.execSql(request);
    });

}
function updateTaskDB(task) {
    pool.acquire(function (err, connection) {
        if (connection === undefined) {
            console.log("Failed to get connection: " + err);
        }
        request = new Request(
            "USE knockAppDB UPDATE Tasks SET Name = @Name, TimerOn = @TimerOn, LastStart = @LastStart, TotalTime = @TotalTime, Hours = @Hours, Minutes = @Minutes, Seconds = @Seconds WHERE Id = @Id;",
            function (err) {
                if (err) {
                    console.log("An error during UPDATE: " + err);
                }
            });
        request.addParameter('Id', TYPES.Int, task['Id']);
        request.addParameter('Name', TYPES.NVarChar, task['Name']);
        request.addParameter('InitialStart', TYPES.BigInt, task['InitialStart']);
        request.addParameter('LastStart', TYPES.BigInt, task['LastStart']);
        request.addParameter('TotalTime', TYPES.BigInt, task['TotalTime']);
        request.addParameter('Hours', TYPES.BigInt, task['Hours']);
        request.addParameter('Minutes', TYPES.BigInt, task['Minutes']);
        request.addParameter('Seconds', TYPES.BigInt, task['Seconds']);
        request.addParameter('TimerOn', TYPES.Bit, task['TimerOn']);
        connection.execSql(request);
    });

}
//loads all distinct task names from db
function loadTaskNameDictionaryDB(res) {
    console.log("about to aquire new connection. Total active connections: " + totalActiveConnections);
    pool.acquire(function (err, connection) {
        if (err) {
            console.error(err);
            return;
        }
        totalActiveConnections++;
        var RS = [];
        request = new Request(
            "USE knockAppDB SELECT DISTINCT [Name] FROM Tasks  WHERE googleUserId = @googleUserId",
            function (err) {
                if (err) {
                    console.log("An error during loadTaskNameDictionaryDB: " + err);
                }


            });
        request.addParameter('googleUserId', TYPES.BigInt, googleUserId);
        connection.execSql(request);

        request.on('row', function (columns) {
            var row = {};
            columns.forEach(function (column) {
                if (column.isNull) {
                    row[column.metadata.colName] = null;
                } else {
                    row[column.metadata.colName] = column.value;
                }
            });
            RS.push(row);
        });
        request.on('doneProc', function (rowCount, more, returnStatus, rows) {
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify(RS));
            res.end();
            if (connection != undefined) {
                totalActiveConnections--;
                connection.release();
            }
        });
        // connection.execSql(request);
    });
};

function loadDataForGoogleChartDB(dateRange, res) {
    pool.acquire(function (err, connection) {
        if (err) {
            console.error(err);
            return;
        }
        totalActiveConnections++;
        var RS = [];
        //TODO get rid of hardcoded values and pass user's parameters
        // var endDate = 1492792719;
        //var startDate = 0;
        request = new Request(
            // TODO: column names
            //  BeginOfTheDayInSeconds
            //  TotalWeekTimeSeconds
            // Select weekly total time spent on tasks, grouped by initialStart dates converted to Monday for each week. 

            //TODO: delete this backup query when done with charts
            //"USE knockAppDB; SELECT startTime, (SUM(TotalTime))/3600 as TotalWeekTimeInHours FROM  "
            //+ "(SELECT dateadd(week, InitialStart / 3600 / 24 / 7, '19691230') as startTime, TotalTime FROM Tasks  WHERE InitialStart BETWEEN @startDate AND @endDate AND googleUserId = @googleUserId) as T "
            //+ "GROUP BY startTime "
            //+ "ORDER BY startTime;",
            "USE knockAppDB;"
            + " SELECT Name, (SUM(totalTime)) / 60 as TotalTimeInHours"
            + " FROM Tasks"
            + " WHERE InitialStart BETWEEN @startDate AND @endDate AND googleUserId = @googleUserId"
            + " GROUP BY Name"
            + " ORDER BY TotalTimeInHours DESC;",

            function (err) {
                if (err) {
                    console.log("An error during loadTaskNameDictionaryDB: " + err);
                }
            });
        request.addParameter('googleUserId', TYPES.BigInt, googleUserId);
        request.addParameter('startDate', TYPES.BigInt, dateRange.start);
        request.addParameter('endDate', TYPES.BigInt, dateRange.end);
        connection.execSql(request);

        request.on('row', function (columns) {
            var row = {};
            columns.forEach(function (column) {
                if (column.isNull) {
                    row[column.metadata.colName] = null;
                } else {
                    row[column.metadata.colName] = column.value;
                }
            });
            RS.push(row);
        });
        request.on('doneProc', function (rowCount, more, returnStatus, rows) {
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify(RS));
            res.end();
            if (connection != undefined) {
                totalActiveConnections--;
                connection.release();
            }
        });
    });
}

function loadAllTasksDB(res) {
    //acquire a connection
    console.log("about to aquire new connection. Total active connections: " + totalActiveConnections);
    pool.acquire(function (err, connection) {
        if (err) {
            console.error(err);
            return;
        }
        totalActiveConnections++;

        var RS = [];
        request = new Request(
            "USE knockAppDB SELECT Id, Name, InitialStart, LastStart, TotalTime, Hours, Minutes, Seconds, TimerOn FROM Tasks WHERE googleUserId = @googleUserId ORDER BY InitialStart DESC",
            function (err) {
                if (err) {
                    console.log("An error during loadAllTasks: " + err);
                }


            });
        request.addParameter('googleUserId', TYPES.BigInt, googleUserId);
        connection.execSql(request);

        request.on('row', function (columns) {
            var row = {};
            columns.forEach(function (column) {
                if (column.isNull) {
                    row[column.metadata.colName] = null;
                } else {
                    row[column.metadata.colName] = column.value;
                }
            });
            RS.push(row);
        });
        request.on('doneProc', function (rowCount, more, returnStatus, rows) {
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify(RS));
            res.end();
            connection.release();
            totalActiveConnections--;
        });
        //release the connection back to the pool when finished
        // connection.release();
        // connection.execSql(request);
    });
}
//UPDATE Table SET column= true WHERE userId = n
function stopAllTasks(res) { };
var server = http.createServer(function (req, res) {
    //getUserGoogleIDCoockie(req, res);
    var cookies = new Cookies(req, res);//, { "secure": true });
    googleUserId = cookies.get('userid');
    if (req.url === "/") {
        fs.readFile("Client/Views/Index.html", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write('Contents you are looking are Not Found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(pgResp);
            }

            res.end();
        });
    }
    else if (req.url === "/Controllers/taskController.js") {
        fs.readFile("Client/Controllers/taskController.js", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find controller. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    else if (req.url === "/Directives/angular-touch.js") {
        fs.readFile("Client/Directives/angular-touch.js", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find angular-touch js. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    else if (req.url === "/Directives/angular-carousel.js") {
        fs.readFile("Client/Directives/angular-carousel.js.js", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find angular-carousel js. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    else if (req.url === "/Styles/main.css") {
        fs.readFile("Client/Styles/main.css", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find stylesheet. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    else if (req.url === "/Styles/angular-carousel.css") {
        fs.readFile("Client/Styles/angular-carousel.css", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find stylesheet. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    else if (req.url === "/Styles/Images/favicon.ico") {
        fs.readFile("Client/Styles/Images/favicon.ico", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find the favicon. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'image/ico' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    else if (req.url === "/Styles/Images/favicon.ico") {
        fs.readFile("Client/Styles/Images/favicon.ico", function (error, pgResp) {
            if (error) {
                res.writeHead(404);
                res.write("Couldn't find the favicon. Sorry");
            } else {
                res.writeHead(200, { 'Content-Type': 'image/ico' });
                res.write(pgResp);
            }
            res.end();
        });
    }
    //else if (req.url === "/Styles/Styles/ngFader.css") {
    //    fs.readFile("Client/Styles/ngFader.css", function (error, pgResp) {
    //        if (error) {
    //            res.writeHead(404);
    //            res.write("Couldn't find the ngFader css. Sorry");
    //        } else {
    //            res.writeHead(200, { 'Content-Type': 'image/ico' });
    //            res.write(pgResp);
    //        }
    //        res.end();
    //    });
    //}
    else if (req.url === "/createTask") {
        var jsonString = '';
        req.on('data', function (data) {
            jsonString += data;
        })
        req.on('end', function () {
            var newTask = JSON.parse(jsonString);

            //connection.on('connect', function (err) {
            // If no error, then good to proceed.  
            createTaskDB(newTask, res);
            //});
        });
    }
    else if (req.url === "/deleteTask") {
        var jsonString = '';
        req.on('data', function (data) {
            jsonString += data;
        })
        req.on('end', function () {
            var id = JSON.parse(jsonString);
            deleteTaskDB(id);
        });
        res.end();
    }
    else if (req.url === "/updateTask") {
        var jsonString = '';
        req.on('data', function (data) {
            jsonString += data;
        })
        req.on('end', function () {
            var task = JSON.parse(jsonString);
            updateTaskDB(task);
            io.to('838563584091570176').emit('update', task);
        });
        res.end();
    }
    else if (req.url === "/loadAllTasks") {
        loadAllTasksDB(res);
    }
    else if (req.url === "/stopAllTasks") {
        // stopAllTasks(res);
    }
    else if (req.url === "/keepAlive") {
        res.end();
    }
    else if (req.url === "/loadTaskNameDictionary") {
        loadTaskNameDictionaryDB(res);
    }
    else if (req.url === "/loadDataForGoogleChart") {
        var jsonString = '';
        req.on('data', function (data) {
            jsonString += data;
        })
        req.on('end', function () {
            var dateRange = JSON.parse(jsonString);
            loadDataForGoogleChartDB(dateRange, res);
        });
        // loadDataForGoogleChartDB(res);
    }
    else if (req.url == "/tokensignin") {
        var jsonString = '';
        req.on('data', function (data) {
            jsonString += data;
        })
        req.on('end', function () {
            //var userToken = JSON.parse(jsonString);
            token = jsonString;
            //cheking that the user token is valid
            client.verifyIdToken(token, CLIENT_ID, function (e, login) {
                var payload = login.getPayload();
                userid = payload['sub'];
                cookies.set('userid', userid, { httpOnly: false });//TODO add expiration date to it
                res.end();
            });
        });
    }
    //else if (req.url == "/firsttimevisitor") {
    //        //cheking that the user token is valid
    //            var visitedTaskTicker = true;
    //            cookies.set('visitedTaskTicker', visitedTaskTicker);//TODO add expiration date to it
    //            console.log(visitedTaskTicker);
    //}
});
//Socket.io 
//io.on('connection', function (socket) {
//    socket.emit('news', { hello: 'world' });
//    socket.on('my other event', function (data) {
//        console.log(data);
//    });
//});



//Socket.io
var ioRoom = "room1";
io = require('socket.io')(server);
io.sockets.on('connection', function (socket) {
    socket.broadcast.emit('news', {
        hello: 'socket'
    });
    socket.on('my other event', function (data) {
        console.log('socketIO');
        console.log(data);
    });
}); 