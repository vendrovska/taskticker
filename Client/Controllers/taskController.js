// JavaScript source code

(function () {
    'use strict';

    angular.module('knockApp', ['ngMaterial', 'ngCsv', 'ngSanitize', 'ngCookies', 'btford.socket-io', 'googlechart'])//, 'angular-carousel'])
        .controller('taskController', taskController)
        .directive('autoComplete', function ($timeout) {
            return function (scope, iElement, iAttrs) {
                iElement.autocomplete({
                    source: scope[iAttrs.uiItems],
                    select: function () {
                        $timeout(function () {
                            iElement.trigger('input');
                        }, 0);
                    }
                });
            };
        });
    function taskController($scope, $interval, $http, $anchorScroll, $location, $cookies, $mdDialog, googleChartApiPromise) {
        $scope.collapsed = false;

        $scope.date = new Date();
        $scope.currentDay = new Date();
        $scope.currentDay = $scope.currentDay.getTime() / 1000;
        $scope.dayInSeconds = 86400;
        // $scope.todayDayStart = $scope.date;
        //$scope.todayDayStart.setHours(0, 0, 0, 0);
        //$scope.todayDayEnd = new Date();
        //$scope.todayDayEnd.setDate($scope.todayDayEnd.getDate() + 1);
        //$scope.todayDayStart = $scope.todayDayStart.getTime() / 1000;
        // console.log($scope.todayDayEnd);
        //to get date starting from the week ago
        var weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        $scope.chartStartDate = new Date(weekAgo);
        $scope.chartEndDate = new Date();
        $scope.chartmMinDate = new Date(19700130);
        $scope.chartmMaxDate = new Date(8640000000000000);
        $scope.taskNamesDictionary = [];
        //$scope.taskNamesDictionary = ["Today", "The day before", "Older"]
        $scope.workItems = [];
        $scope.Math = window.Math;
        $scope.editingTaskName = false;
        var timerVar;
        //variables for tasks list
        // $scope.timePeriods = ["Today", "The day before", "Older"];
        var todayTasks = [];
        var theDayBeforeTasks = [];
        var oldTasks = [];
        $scope.allTaskList = [todayTasks, theDayBeforeTasks, oldTasks];
        //
        $scope.userInfo = {
            token: 0,
            userName: '',
            userPic: '#',
            signedIn: false

        };
        //Saving task list to csv 
        $scope.getCsvFiledata = function () {
            var res = [];//[ "Id", "Name", "InitialStart", "LastStart", "TotalTime", "Hours", "Minutes", "Seconds", "TimerOn"];
            $scope.workItems.forEach(function (task) {
                var tempTask = {
                    Id: task["Id"],
                    Name: task["Name"],
                    InitialStart: new Date(1000 * task["InitialStart"]),
                    LastStart: new Date(1000 * task["LastStart"]),
                    TotalTimeInSeconds: task["TotalTime"],
                    Hours: task["Hours"],
                    Minutes: task["Minutes"],
                    Seconds: task["Seconds"],
                    TimerOn: task["TimerOn"]
                }
                res.push(tempTask);
            });

            return res;
        }
        $scope.getCsvHeader = function () {
            return ["Id", "Name", "InitialStart", "LastStart", "TotalTimeInSeconds", "Hours", "Minutes", "Seconds", "TimerOn"];
        };
        //Google sign in for more refference on how to implement: https://developers.google.com/identity/sign-in/web/backend-auth
        function resetPageForNewUser() {
            todayTasks = [];
            theDayBeforeTasks = [];
            oldTasks = [];
            //allRowsForChart = []; //to clean out the Google Chart TODO: Clean cookies after sign out

            $scope.taskNamesDictionary = [];
            $scope.allTaskList = [todayTasks, theDayBeforeTasks, oldTasks];
            $scope.userInfo = {
                token: 0,
                userName: '',
                userPic: '#',
                signedIn: false

            };
        }
        $scope.signOut = function () {
            var auth2 = gapi.auth2.getAuthInstance();

            auth2.signOut().then(function () {
                // removing a cookie
                auth2.disconnect();
                $cookies.remove('userid', { path: '/' });
                delete $cookies['userid'];
                // $cookies.put('userid','0');
                resetPageForNewUser();
            });



        }
        function onSignIn(googleUser) {
            var id_token = googleUser.getAuthResponse().id_token;
            var userBasicInfo = googleUser.getBasicProfile();
            var userPic = userBasicInfo['Paa'];
            var userName = userBasicInfo['ofa'];
            $scope.userInfo['token'] = id_token;
            $scope.userInfo['userPic'] = userPic;
            $scope.userInfo['userName'] = userName;
            $scope.userInfo['signedIn'] = true;
            $http.post('/tokensignin', id_token)
                .success(function (data) {
                    $scope.workItems = [];
                    loadAllTasks();


                })
                .error(function (data) {
                    console.error("error happened in http " + data);
                });
            $scope.$apply();
        };

        window.onSignIn = onSignIn;
        $scope.taskNameStaticVisible = true; //TODO delete
        var id = 20;//TODO: generate ID in database
        var totalSeconds = 0;
        var curItem = {};
        $scope.count = 0;
        $scope.newItemName = "";
        $scope.date = new Date();
        $scope.workItemMessage = "ADD TASK";
        4
        function createTask(newTask) {
            $scope.taskNamesDictionary.unshift(newTask['Name']);
            $http.post('/createTask', newTask)
                .success(function (data) {
                    newTask['Id'] = data;

                })
                .error(function (data) {
                    console.error("error happened in http " + data);
                });
        }
        //handeling scroll to the top button
        $(window).scroll(function () {
            if ($(this).scrollTop() > 100) {
                $('#gotoThePageTop').fadeIn();
            } else {
                $('#gotoThePageTop').fadeOut();
            }
        });
        $scope.scrollUp = function () {
            //$window.scrollTo(0, 0);
            $anchorScroll();
        }

        //Add new task to the list
        function addNewTaskHelper() {
            $scope.count = 1;
            var newItem = {
                Id: 0,
                Name: String($scope.newItemName),
                LastStart: (new Date().getTime()) / 1000,
                InitialStart: (new Date().getTime()) / 1000,
                TotalTime: 0,
                Hours: 0,
                Minutes: 0,
                Seconds: 0,
                TimerOn: false,
                Timer: {},

            };
            id++;
            $scope.newItemName = "";
            createTask(newItem);
            todayTasks.unshift(newItem);
            //clear form aftewards
            $scope.newTaskForm.$setPristine();
            $scope.newTaskForm.$setUntouched();
            $("#newItemFormId textarea").val('');
        };
        $scope.addNewTask = function (event, formValid) {
            if (event.keyCode == 13 || event.type == "submit") {
                var minLength = $("#newItemFormId textarea").text.length;
                if (formValid && minLength > 0) {
                    addNewTaskHelper();
                }
            }

        };


        //Remove task from the list
        $scope.removeTask = function (id) {
            //TODO: add confirmation before and after the event
            $http.post('/deleteTask', id)
                .success(function (data) {
                    var itemsArr = $scope.allTaskList;
                    for (var i = 0; i < itemsArr.length; i++) {
                        itemsArr[i].forEach(function (arr, index) {
                            if (arr['Id'] == id) {
                                itemsArr[i].splice(index, 1);
                                return;

                            }
                        });
                    }
                })
                .error(function (data) {
                    console.error("error, didn't delete the task" + data);
                });

        };
        //load dictionary for angular auto complete
        function loadTaskNameDictionary() {
            $http.get("/loadTaskNameDictionary")
                .then(
                function (response) {
                    if ($scope.taskNamesDictionary.length > 0) {

                        $scope.taskNamesDictionary = [];
                    }
                    response.data.forEach(function (item) {
                        $scope.taskNamesDictionary.unshift(item.Name);
                    });
                },
                function (error) {
                    console.log("error in loadTaskNameDictionary: " + error);
                }
                )
        };
        //load all tasks from the DB
        function loadAllTasks() {
            //load dictionary for autocomplete
            loadTaskNameDictionary();
            $http.get('/loadAllTasks')
                .then(
                function (response) {
                    // success callback
                    $scope.workItems = response.data;//TODO rename workITems to taskList
                    var secondMostRecentDate = 0;
                    $scope.workItems.forEach(function (item) {
                        var currentTime = new Date();
                        currentTime.setHours(0, 0, 0, 0);
                        var taskInitialStart = new Date(1000 * item.InitialStart);
                        //Fill out allTaskList array according to the date task was  created. 
                        if (secondMostRecentDate == 0 && currentTime > taskInitialStart) {
                            secondMostRecentDate = taskInitialStart;
                            secondMostRecentDate.setHours(0, 0, 0, 0);
                        }
                        if (taskInitialStart >= currentTime) {
                            todayTasks.unshift(item);
                        }
                        else if (taskInitialStart >= secondMostRecentDate) {
                            theDayBeforeTasks.unshift(item);
                        }
                        else {
                            oldTasks.unshift(item);
                        }

                        item.TotalTime = parseInt(item.TotalTime);
                        item.LastStart = parseInt(item.LastStart);
                        item.InitialStart = parseInt(item.InitialStart);

                        // caclulate additional time during which the item was running
                        if (item.TimerOn == 1) {
                            var mockEnd = Math.floor((new Date().getTime()) / 1000);
                            //TODO check if the item wasn't running for too long
                            var timeGone = Math.floor((mockEnd - item.LastStart));
                            item.TotalTime += timeGone;
                        }

                        checkAndArchiveItem(item);
                        if (item.TimerOn == 1) {
                            startStopwatchHelper(item);
                        }


                    });

                    //fill out date groups for page layout
                    $scope.timePeriods = [
                        {
                            title: "Today",
                            date: new Date()
                        },
                        {
                            title: "The day before",
                            date: secondMostRecentDate

                        },
                        {
                            title: "Older",
                            date: new Date(1000 * oldTasks[0]['InitialStart'])
                        }
                    ];
                },
                function (error) {
                    // failure call back
                    console.log(error);
                }
                );
        };

        // Stop and archive long-running items (we want them to run not longer than 24hrs)
        function checkAndArchiveItem(item) {
            if (new Date().getTime() / 1000 - item.InitialStart > 86400) {
                console.log("archiving item");
                item.Archived = true;
                item.TimerOn = 0;
                item.TotalTime = Math.min(item.TotalTime, 86400);
                if (item.Timer !== null && item.Timer !== undefined) {
                    $interval.cancel(item.Timer);
                }
                updateTask(item);
            }
        }

        //stop all task for the user TODO:complete this, doesn't work on server at the moment
        $scope.stopAllTasks = function () {
            //$http.post('/stopAllTasks')
            //    .success(function (data) {
            //        loadAllTasks();
            //        //TODO: think if maybe $scope.workItems.forEach(function(){}); would be enough.
            //    })
            //    .error(function () {
            //        onsole.error("error happened in http " + data);
            //    });
        };
        //receive selected task and start incrementing the time
        $scope.startStopwatch = function (item) {
            startStopwatchHelper(item);

        };
        function startStopwatchHelper(item) {
            item.LastStart = Math.floor((new Date().getTime()) / 1000);
            item.TimerOn = true;
            //send updates to the database
            updateTask(item);
            item.Timer = $interval(countTimer, 1000);
            function countTimer() {
                item.TotalTime++;
                item.Hours = Math.floor(item.TotalTime / 3600);
                item.Minutes = Math.floor((item.TotalTime - item.Hours * 3600) / 60);
                item.Seconds = item.TotalTime - (item.Hours * 3600 + item.Minutes * 60);
                checkAndArchiveItem(item);
                //$scope.$apply();
            }

        };
        function updateTask(task) {
            //TODO: prettify this, shouldn't convert it manually every time
            task.Hours = Math.floor(task.TotalTime / 3600);
            task.Minutes = Math.floor((task.TotalTime - task.Hours * 3600) / 60);
            task.Seconds = task.TotalTime - (task.Hours * 3600 + task.Minutes * 60);
            //task.Hours = parseInt(task.Hours);
            //task.Minutes = parseInt(task.Minutes);
            //task.Seconds = parseInt(task.Seconds);
            task.Id = parseInt(task.Id);
            $http.post('/updateTask', task)
                .success(function (data) {
                })
                .error(function (datag) {
                    console.log("keep alive foo got broken " + data);
                });
        };
        $scope.pauseStopwatch = function (item) {
            // clearInterval(item.timer);
            item.TimerOn = false;
            updateTask(item);
            $interval.cancel(item.Timer);
            //update endDate in db
        };
        $scope.resetStopWatch = function (item) {
            item.TotalTime = 0;
            item.Hours = 0;
            item.Minutes = 0;
            item.Seconds = 0;
            item.TimerOn = false;
            updateTask(item);
            $interval.cancel(item.Timer);
        };

        $scope.updateTaskName = function (item) {
            var id = 'p' + item.Id;
            var newName = $('#' + id).text().trim();

            if (newName.length > 256 || newName.length <= 0) {
                alert('Sorry, the description must not be more than 2000 characters long');
            }
            else {
                item.Name = newName;
                updateTask(item);

            }
            // $('#' + id).text = " ";
            $('#' + id).text(item.Name);
            $('#' + id).blur();
            // alert('dummy');//TODO rename the function, use it for task updates, display "waiting" while saving to db
        };
        //inplace timer editing
        $scope.updateTaskTimer = function (item, val) {
            var newVal = $(".taskTimerHours_" + item.Id).text();
            switch (val) {
                case "hours":
                    console.log(val);
                    item.Hours = newVal;
                    $(".taskTimerHours_" + item.Id).text = newVal;
                    updateTask(item);
                case "minutes":
                    console.log(val);
                default:
                    console.log(val);
            }

        }
        $scope.decrementTaskTime = function (n, item) {
            var timeDiff = n * 60;
            item['TotalTime'] -= timeDiff;
            if (item['TotalTime'] < 0) {
                item['TotalTime'] = 0;
            }
            //console.log(item['TotalTime'].add(n).minutes());
            updateTask(item);

        };
        $scope.incrementTaskTime = function (n, item) {
            var timeDiff = n * 60;
            item['TotalTime'] += timeDiff;
            //compare total time to max int value
            if (item['TotalTime'] > 2147483647) {
                alert("Sorry, but the time value is too big.");
                item['TotalTime'] -= timeDiff;
            }
            updateTask(item);
            console.log(item['TotalTime']);
        };

        //prevent leading whitespaces in form input
        $('#newItemFormId textarea').on('keypress', function (e) {
            console.log(this.value.trim().length);
            if (this.value.trim() == 0) {
                if (e.which == 32)
                    return false;
            }

        });
        //prevent new line in textarea and Nameinputs for enter click
        $("#newItemFormId textarea").keypress(function (event) {
            console.log('textarea');
            if (event.keyCode === 13)
                event.preventDefault();
        });
        $("p").keypress(function (event) {
           
            if (event.keyCode === 13) {

                event.preventDefault();
            }
        });

        //Google Charts
        $scope.showChart = false;
        var allRowsForChart;
        $scope.drawGoogleChart = function () {
            if (!$scope.showChart) {
                $scope.showChart = true;
                googleChartApiPromise.then(loadDataForGoogleChart);
            }
            else {
                $scope.showChart = false;
            }
        };
        function loadDataForGoogleChart() {
            var timeRange = {
                start: ($scope.chartStartDate.getTime()) / 1000,
                end: ($scope.chartEndDate.getTime()) / 1000
            };
            $http.post("/loadDataForGoogleChart", timeRange)
                .then(
                function (response) {
                    var data = response.data;
                    allRowsForChart = [];
                    data.forEach(function (item) {
                        var currentName = item.Name;

                        // var timeInSeconds = parseInt(item.TotalTimeInHours);

                        var timeInHours = parseInt(item.TotalTimeInHours);
                        var temp = timeInHours;
                        var hours = parseInt((temp / 60));
                        var minutes = ((temp % 60) / 60);
                        var temp = hours + minutes;
                        timeInHours = parseFloat(temp);
                        timeInHours = Math.round(timeInHours * 1e2) / 1e2;
                        var curRowArr = [currentName, timeInHours];
                        allRowsForChart.push(curRowArr);
                    });
                    buildDataTable(allRowsForChart);
                },
                function (error) {
                    console.log("error in loadTaskNameDictionary: " + error);
                }
                )
        }
        function buildDataTable(allRowsForChart) {
            var table = new google.visualization.DataTable();
            table.addColumn("string", "Name");
            table.addColumn("number", "Hours");
            table.addRows(allRowsForChart);
            $scope.myChartObject = {
                type: "BarChart",
                cssStyle: "height:600px; width:100%",
                options: {
                    title: "Tasks per given time period"
                },
                data: table
            };
            $scope.myChartObject.options = {
                title: 'Hours per time range',
                hAxis: {
                    title: 'Total Time Spent'
                },
                vAxis: {
                    title: 'Task Name'
                },
                timeline: {
                    groupByRowLabel: true
                }
            };
        };
        //$scope.$watch("chartStartDate", function () {
        //    onChange(" kuku chartStartDate");
        //});
        //$scope.$watch("chartEndDate", function () {
        //    onChange(" kuku chartEndDate");
        //});
        $scope.chartDatepickerChange = function () {
            loadDataForGoogleChart();
        };

        //SECONDARY HELPERS
        $scope.showAdvanced = function () {
            showAdvancedHelper();
        };
        function showAdvancedHelper() {
            $mdDialog.show({
                controller: DialogController,
                templateUrl: 'dialog1.tmpl.html',
                parent: angular.element(document.body),
                //targetEvent: ev,
                clickOutsideToClose: true,
                fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
            })

                //.then(function (answer) {
                //    $scope.status = 'You said the information was "' + answer + '".';
                //}, function () {
                //    $scope.status = 'You cancelled the dialog.';
                //});
        }
        showAdvancedHelper();
        function DialogController($scope, $mdDialog) {
            $scope.hide = function () {
                $mdDialog.hide();
            };

            $scope.cancel = function () {
                $mdDialog.cancel();
            };

            $scope.answer = function (answer) {
                $mdDialog.hide(answer);
            };
        }
        //TODO: remove keepAlive when switched to other server. Need it now only because Azure puts server to sleep.
        //function keepAlive() {
        //    setInterval(keepAliveCall, 1000000);


        //}
        //function keepAliveCall() {
        //    $http.post('/keepAlive')
        //        .success(function (data) {
        //            console.log(data);
        //        })
        //        .error(function (data) {
        //            console.log("error in keep alive" + data);
        //        });
        //}
        //keepAlive();
    }

    //Socket.io
    var socket = io();
    socket.join("838563584091570176"); // room as user id 
    socket.on("update", function (task) {

    });

    socket.on('news', function (data) {
        console.log(data);
        socket.emit('my other event', { my: 'data lala' });
    });
   


})();
