import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import {Md5} from 'ts-md5/dist/md5';

// main configuration
admin.initializeApp(functions.config().firebase);

const db = admin.firestore();
const app = express();
const main = express();

const userCollections = 'user';
const deviceCollections = 'device';
const dataCollections = 'data';
const dataLogCollections = 'data_log';

main.use('/api/v1', app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
app.use(cors({ origin: true }));

export const webAPI = functions.https.onRequest(main);

// interfaces
interface UserData {
    name: string,
    email: string,
    password: string,
    last_update: string
}
interface DeviceData {
    name: string,
    status: boolean,
    description: string,
    id_user: string,
    last_update: string
}
interface SensorData {
    name: string,
    value: any,
    id_device: string,
    last_update: string
}
interface LogData {
    id_data: string,
    value: any,
    timestamp: string
}

// external functions
function getNowDate () {
    const nowDate = new Date();
    const newDate = 
        nowDate.getUTCFullYear() + "-" +
        addZeroForTwoChar((nowDate.getUTCMonth() + 1).toString()) + "-" +
        addZeroForTwoChar(nowDate.getUTCDate().toString()) + " " +
        addZeroForTwoChar(nowDate.getUTCHours().toString()) + ":" +
        addZeroForTwoChar(nowDate.getUTCMinutes().toString()) + ":" +
        addZeroForTwoChar(nowDate.getUTCSeconds().toString());
    return newDate;
}

function addZeroForTwoChar (myChar: string) {
    if (myChar.length === 1) {
        return "0" + myChar;
    }
    else {
        return myChar;
    }
}

function md5Hash (myString: string) {
    return Md5.hashStr(myString).toString();
}

function convertToDate (time: any) {
    // time passed is String, construct into Date format
    // time example from json: "2019-03-08 16:32:00"
    // format: YEAR-MONTH-DATEOFMONTH HOUR:MINUTE:SECOND

    // split into DATE form and HOUR form
    const splitTime = time.split(" ");

    ////////////////////////////////////////////
    //  DATE PART                             //
    ////////////////////////////////////////////

    // resultDate = YEAR-MONTH-DATEOFMONTH
    const resultDate = splitTime[0];

    // split DATE into YEAR, MONTH, and DATEOFMONTH
    const splitDate = resultDate.split("-");

    const resultYear = splitDate[0];
    const resultMonth = splitDate[1] - 1;
    const resultDateOfMonth = splitDate[2];

    ////////////////////////////////////////////
    //  HOUR PART                             //
    ////////////////////////////////////////////

    // resultHour = HOUR:MINUTE:SECOND
    const resultHour = splitTime[1];

    // split HOUR into HOUR, MINUTE, and SECOND
    const splitHour = resultHour.split(":");

    const resultHourC = splitHour[0];
    const resultMinute = splitHour[1];
    const resultSecond = splitHour[2];

    ////////////////////////////////////////////
    //  CONSTRUCT DATE PART                   //
    ////////////////////////////////////////////

    // now we get every component to construct date from String
    return new Date(
        resultYear,
        resultMonth,
        resultDateOfMonth,
        resultHourC,
        resultMinute,
        resultSecond,
        0
    );
}

// CRUD functions

// 1. (C)reate

// 1.1. Create new user
/**
 * @param name string
 * @param email string
 * @param password string
 */
app.post('/User/Create', async (req, res) => {
    const userName = req.body['name'];
    const userEmail = req.body['email'];
    const userPassword = req.body['password'];

    try {

        // check if there any user using the same email
        const userRef = db.collection(userCollections);
        userRef.where('email', '==', userEmail).get()
            .then(snapshot => {

                // if found
                if(snapshot.empty === false) {
                    res.send({
                        "code": 400,
                        "msg": "email address is already used",
                        "success": false,
                        "result": "Cannot register with this email, another user has been found!"
                    });
                    return;
                }

                const newPass = md5Hash(userPassword);
                const userUniqueInput: UserData = {
                    "name": userName,
                    "email": userEmail,
                    "password": newPass,
                    "last_update": getNowDate()
                }

                userRef.add(userUniqueInput).then().catch();

                res.send({
                    "code": 201,
                    "msg": "success",
                    "success": true,
                    "result": "ok"
                });
            })
            .catch();
    }
    catch (err) {
        res.status(400).send({
            "code": 400,
            "msg": "fail to create new user, wrong parameters",
            "success": false,
            "result": err
        });
    }
});

// 1.2. Create new device
/**
 * @param name string
 * @param status boolean
 * @param description string
 * @param id_user string
 */
app.post('/Device/Create', async (req, res) => {
    const deviceName = req.body['name'];
    const deviceStatus = req.body['status'];
    const deviceDesc = req.body['description'];
    const deviceUserId = req.body['id_user'];

    try {

        // check if there any device using the same name
        const deviceRef = db.collection(deviceCollections);
        deviceRef
            .where('name', '==', deviceName)
            .where('id_user', '==', deviceUserId).get()
            .then(snapshot => {

                // if found
                if(snapshot.empty === false) {
                    res.send({
                        "code": 400,
                        "msg": "device name is already used",
                        "success": false,
                        "result": "Cannot add new device with this name, choose another name!"
                    });
                    return;
                }

                const deviceUniqueInput: DeviceData = {
                    "name": deviceName,
                    "status": deviceStatus,
                    "description": deviceDesc,
                    "id_user": deviceUserId,
                    "last_update": getNowDate()
                }
        
                deviceRef.add(deviceUniqueInput).then().catch();
        
                res.send({
                    "code": 201,
                    "msg": "success",
                    "success": true,
                    "result": "ok"
                });
            })
            .catch();
    }
    catch (err) {
        res.status(400).send({
            "code": 400,
            "msg": "fail to create new device, wrong parameters",
            "success": false,
            "result": err
        });
    }
});

// 1.3. Create new data sensor
/**
 * @param name string
 * @param value string
 * @param id_device string
 */
app.post('/Data/Create', async (req, res) => {
    const dataName = req.body['name'];
    const dataValue = req.body['value'];
    const dataDeviceId = req.body['id_device'];

    try {

        // check if there any device using the same name
        const dataRef = db.collection(dataCollections);
        dataRef
            .where('name', '==', dataName)
            .where('id_device', '==', dataDeviceId).get()
            .then(snapshot => {

                // if found
                if(snapshot.empty === false) {
                    res.send({
                        "code": 400,
                        "msg": "data name is already used",
                        "success": false,
                        "result": "Cannot add new data with this name, choose another name!"
                    });
                    return;
                }

                const dataUniqueInput: SensorData = {
                    "name": dataName,
                    "value": dataValue,
                    "id_device": dataDeviceId,
                    "last_update": getNowDate()
                }
        
                dataRef.add(dataUniqueInput).then().catch();
        
                res.send({
                    "code": 201,
                    "msg": "success",
                    "success": true,
                    "result": "ok"
                });
            })
            .catch();
    }
    catch (err) {
        res.status(400).send({
            "code": 400,
            "msg": "fail to create new data, wrong parameters",
            "success": false,
            "result": err
        });
    }
});

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

// 2. (R)ead

// 2.1. Read one user info
app.get('/User/GetInfo/:email', (req, res) => {
    const dataRef = db.collection(userCollections);
    const email = req.params.email;

    dataRef.where('email', '==', email).get()
        .then(snapshot => {

            // if no collection found
            if (snapshot.empty) {
                res.send({
                    "code": 404,
                    "msg": "no user is found",
                    "success": false,
                    "result": {}
                });
                return;
            }  
        
            // collection found, get all documents
            snapshot.forEach(doc => {
                const tempData = doc.data();
                res.send({
                    "code": 200,
                    "msg": "success",
                    "success": true,
                    "result": {
                        "id": doc.id,
                        "name": tempData['name'],
                        "email": tempData['email'],
                        "last_update": tempData['last_update']
                    }
                });
                return;
            });
        })
        .catch(err => {
            res.send({
                "code": 400,
                "msg": "error while getting data",
                "success": false,
                "result": {}
            });
        })
})

// 2.2. Read device (all) of a user
app.get('/Device/GetAll/:email', (req, res) => {
    const deviceRef = db.collection(deviceCollections);
    const userRef = db.collection(userCollections);
    const email = req.params.email;

    userRef.where('email', '==', email).get()
        .then(snapshot => {
            let id_user = "";
            
            snapshot.forEach(data => {
                id_user = data.id;
            });

            deviceRef.where('id_user', '==', id_user).get()
                .then(snapshot2 => {
                    const data: FirebaseFirestore.DocumentData[] = [];

                    // if no collection found
                    if (snapshot2.empty) {
                        res.send({
                            "code": 404,
                            "msg": "no device is found",
                            "success": false,
                            "result": []
                        });
                        return;
                    }  
                
                    // collection found, get all documents
                    snapshot2.forEach(doc => {
                        const result = {
                            "id": doc.id,
                            "name": doc.data()['name'],
                            "status": doc.data()['status'],
                            "description": doc.data()['description'],
                            "id_user": doc.data()['id_user'],
                            "last_update": doc.data()['last_update']
                        }
                        data.push(result);
                    });
                    res.send({
                        "code": 200,
                        "msg": "success",
                        "success": true,
                        "result": data
                    });
                })
                .catch(err => {
                    res.send({
                        "code": 400,
                        "msg": "error while getting data",
                        "success": false,
                        "result": []
                    });
                });
        })
        .catch(e => {
            res.send({
                "code": 404,
                "msg": "no user is found",
                "success": false,
                "result": []
            });
            return;
        })
});

// 2.3. Read device (specific) of a user
app.get('/Device/GetSpecific/:email/DeviceName/:name', (req, res) => {
    const deviceRef = db.collection(deviceCollections);
    const userRef = db.collection(userCollections);
    
    const email = req.params.email;
    const deviceName = req.params.name;

    userRef.where('email', '==', email).get()
        .then(snapshot => {
            let id_user = "";
            
            snapshot.forEach(data => {
                id_user = data.id;
            });

            deviceRef.where('id_user', '==', id_user).get()
                .then(snapshot2 => {
                    
                    // if no collection found
                    if (snapshot2.empty) {
                        res.send({
                            "code": 404,
                            "msg": "no device is found",
                            "success": false,
                            "result": {}
                        });
                        return;
                    }  
                
                    // collection found, get all documents
                    snapshot2.forEach(doc => {
                        const docData = doc.data();
                        if (docData['name'] === deviceName) {
                            const result = {
                                "id": doc.id,
                                "name": docData['name'],
                                "status": docData['status'],
                                "description": docData['description'],
                                "id_user": docData['id_user'],
                                "last_update": docData['last_update']
                            }
                            res.send({
                                "code": 200,
                                "msg": "success",
                                "success": true,
                                "result": result
                            });
                            return;
                        }
                    });
                })
                .catch(err => {
                    res.send({
                        "code": 400,
                        "msg": "error while getting data",
                        "success": false,
                        "result": {}
                    });
                });
        })
        .catch(err => {
            res.send({
                "code": 404,
                "msg": "no user is found",
                "success": false,
                "result": {}
            });
            return;
        })
});

// 2.4. Read data (all) of a device
app.get('/Data/GetAll/:id_device', (req, res) => {
    const dataRef = db.collection(dataCollections);
    const id_device = req.params.id_device;

    dataRef.where('id_device', '==', id_device).get()
        .then(snapshot => {
            const data: FirebaseFirestore.DocumentData[] = [];

            // if no collection found
            if (snapshot.empty) {
                res.send({
                    "code": 404,
                    "msg": "no data is found",
                    "success": false,
                    "result": []
                });
                return;
            }  
        
            // collection found, get all documents
            snapshot.forEach(doc => {
                const getData = doc.data();
                data.push({
                    "id": doc.id,
                    "name": getData['name'],
                    "value": getData['value'],
                    "id_device": getData['id_device'],
                    "last_update": getData['last_update']
                });
            });
            res.send({
                "code": 200,
                "msg": "success",
                "success": true,
                "result": data
            });
        })
        .catch(err => {
            res.send({
                "code": 400,
                "msg": "error while fetching data",
                "success": false,
                "result": []
            });
        });
});

// 2.5. Read data (specific) of a device
app.get('/Data/GetSpecific/:id_device/DataName/:name', (req, res) => {
    const ref = db.collection(dataCollections);
    
    const id_device = req.params.id_device;
    const name = req.params.name;

    ref.where('id_device', '==', id_device)
        .where('name', '==', name).get()
        .then(snapshot => {
            snapshot.forEach(a => {
                const tempArray: FirebaseFirestore.DocumentData[] = [];

                // if no collection found
                if (snapshot.empty) {
                    res.send({
                        "code": 404,
                        "msg": "no data is found",
                        "success": false,
                        "result": {}
                    });
                    return;
                }  
            
                // collection found, get all documents
                snapshot.forEach(doc => {
                    const tempData = doc.data();
                    const tempDataName = tempData['name'];
                    
                    if (tempDataName === name) {
                        tempArray.push({
                            "id": doc.id,
                            "name": tempData['name'],
                            "value": tempData['value'],
                            "id_device": tempData['id_device'],
                            "last_update": tempData['last_update']
                        });
                    }
                });

                if (tempArray.length === 1){
                    res.send({
                        "code": 200,
                        "msg": "success",
                        "success": true,
                        "result": {
                            "id": tempArray[0]['id'],
                            "name": tempArray[0]['name'],
                            "value": tempArray[0]['value'],
                            "id_device": tempArray[0]['id_device'],
                            "last_update": tempArray[0]['last_update']
                        }
                    });
                }
                else {
                    res.send({
                        "code": 200,
                        "msg": "success",
                        "success": true,
                        "result": tempArray
                    });
                }
            })
        })
        .catch(err => {
            res.send(err)
        })
});

// 2.6. Read user id using email
app.get('/User/GetId/:email', (req, res) => {
    const dataRef = db.collection(userCollections);
    const email = req.params.email;

    dataRef.where('email', '==', email).get()
        .then(snapshot => {

            // if no collection found
            if (snapshot.empty) {
                res.send({
                    "code": 404,
                    "msg": "no user is found",
                    "success": false,
                    "result": {}
                });
                return;
            }  
        
            // collection found, get all documents
            snapshot.forEach(doc => {
                const tempData = doc.id;
                res.send({
                    "code": 200,
                    "msg": "success",
                    "success": true,
                    "result": {"id": tempData}
                });
                return;
            });
        })
        .catch(err => {
            res.send({
                "code": 400,
                "msg": "error while getting data",
                "success": false,
                "result": []
            });
        })
});

// 2.7. Read user using id
app.get('/User/GetUser/:id', (req, res) => {
    const userRef = db.collection(userCollections);
    const id = req.params.id;

    userRef.doc(id).get()
        .then(doc => {
            const userData: any = doc.data();
            res.send({
                "code": 200,
                "msg": "success",
                "success": true,
                "result": {
                    "id": doc.id,
                    "name": userData['name'],
                    "email": userData['email'],
                    "last_update": userData['last_update']
                }
            });
        })
        .catch(error => {
            res.send({
                "code": 400,
                "msg": "error while fetching data",
                "success": false,
                "result": {}
            });
        });
});

// 2.8. Read device using id
app.get('/Device/GetDevice/:id', (req, res) => {
    const deviceRef = db.collection(deviceCollections);
    const id = req.params.id;

    deviceRef.doc(id).get()
        .then(doc => {
            const deviceData: any = doc.data();
            res.send({
                "code": 200,
                "msg": "success",
                "success": true,
                "result": {
                    "id": doc.id,
                    "name": deviceData['name'],
                    "status": deviceData['status'],
                    "description": deviceData['description'],
                    "id_user": deviceData['id_user'],
                    "last_update": deviceData['last_update']
                }
            });
        })
        .catch(error => {
            res.send({
                "code": 400,
                "msg": "error while fetching data",
                "success": false,
                "result": {}
            });
        });
});

// 2.9. Read data using id
app.get('/Data/GetData/:id', (req, res) => {
    const dataRef = db.collection(dataCollections);
    const id = req.params.id;

    dataRef.doc(id).get()
        .then(doc => {
            const myData: any = doc.data();
            res.send({
                "code": 200,
                "msg": "success",
                "success": true,
                "result": {
                    "id": doc.id,
                    "name": myData['name'],
                    "value": myData['value'],
                    "id_device": myData['id_device'],
                    "last_update": myData['last_update']
                }
            });
        })
        .catch(error => {
            res.send({
                "code": 400,
                "msg": "error while fetching data",
                "success": false,
                "result": {}
            });
        });
});


// 2.99. Miscellaneous
app.get('/Dummy/GetData/:id_device/Name/:name', (req, res) => {
    const ref = db.collection(dataCollections);
    const id_device = req.params.id_device;
    const name = req.params.name;

    try {
        const result = ref
            .where('id_device', '==', id_device)
            .where('name', '==', name)
            .get();

        result.then(snapshot => {
            snapshot.forEach(a => {
                res.send(a.id);
            })
        }).catch(a => {
            res.send(a)
        })

        // res.send(result);
    } catch (error) {
        res.send(`Error: ${error}`);
    }
});

app.get('/Dummy/GetUser/:email', (req, res) => {
    const ref = db.collection(userCollections);
    const email = req.params.email;

    try {
        const result = ref
            .where('email', '==', email)
            .get();

        result.then(snapshot => {
            snapshot.forEach(a => {
                res.send(a.id);
            })
        }).catch(a => {
            res.send(a)
        })

        // res.send(result);
    } catch (error) {
        res.send(`Error: ${error}`);
    }
});

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////


// 3. (U)pdate

// 3.1. Update User's data using id
app.post('/User/UpdateValue', async (req, res) => {
    const userRef = db.collection(userCollections);
    const userId = req.body['id'];
    const newName = req.body['name'];
    const newEmail = req.body['email'];

    userRef.doc(userId).update({
        "name": newName,
        "email": newEmail,
        "last_update": getNowDate()
    })
    .then(() => {
        res.send({
            "code": 204,
            "msg": "success",
            "success": true,
            "result": "user data updated"
        });
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "fail to update user data, wrong parameters",
            "success": false,
            "result": err
        });
    })
});

// 3.2. Update User's password (need old and new) using id
app.post('/User/ChangePassword', async (req, res) => {
    const userRef = db.collection(userCollections);
    const userId = req.body['id'];
    const oldPass = md5Hash(req.body['old_password']);
    const newPass = md5Hash(req.body['new_password']);
    
    userRef.doc(userId).get()
    .then(result => {
        const data : any = result.data();
        const getPass = data['password'];

        if (getPass === oldPass) {
            userRef.doc(userId).update({
                "password": newPass,
                "last_update": getNowDate()
            })
            .then(() => {
                res.send({
                    "code": 204,
                    "msg": "success",
                    "success": true,
                    "result": "user data updated"
                });
            })
            .catch(err => {
                res.status(400).send({
                    "code": 400,
                    "msg": "fail to update user data, wrong parameters",
                    "success": false,
                    "result": err
                });
            })
        }
        else {
            res.status(400).send({
                "code": 400,
                "msg": "old password not match",
                "success": false,
                "result": "please try again"
            });
        }
    })
    .catch(() => {
        res.status(400).send({
            "code": 400,
            "msg": "failed",
            "success": false,
            "result": "failed to get previous data"
        });
    });
});

// 3.3. Update Device's data using id
app.post('/Device/UpdateValue', async (req, res) => {
    const deviceRef = db.collection(deviceCollections);
    
    const deviceId = req.body['id'];
    const newName = req.body['name'];
    const newStatus = req.body['status'];
    const newDesc = req.body['description'];

    deviceRef.doc(deviceId).update({
        "name": newName,
        "status": newStatus,
        "description": newDesc,
        "last_update": getNowDate()
    })
    .then(() => {
        res.send({
            "code": 204,
            "msg": "success",
            "success": true,
            "result": "device data updated"
        });
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "fail to update device data, wrong parameters",
            "success": false,
            "result": err
        });
    })
});

// 3.4. Update data value using id_device and data's name
/**
 * @param name string
 * @param value any
 * @param id_device string
 */
app.post('/Data/UpdateValue', async (req, res) => { 
    const dataName = req.body['name'];
    const newDataValue = req.body['value'];
    const dataDeviceId = req.body['id_device'];
    
    const dataRef = db.collection(dataCollections);
    const deviceRef = db.collection(deviceCollections);
    const logRef = db.collection(dataLogCollections);

    // update using data id
    const id = req.body['id'];
    if (id) {

// ///////////////////////////////// logging system /////////////////////////////////
//         let oldData: any;
//         dataRef.doc(id).get().then(doc => {
//             oldData = doc.data();
            
//             const logRef = db.collection(dataLogCollections);
//             const logDataInput : LogData = {
//                 "id_data": id,
//                 "value": oldData['value'],
//                 "timestamp": oldData['last_update']
//             }
//             logRef.add(logDataInput).then().catch();
//         }).catch();        
// //////////////////////////////////////////////////////////////////////////////////

        // update data field
        dataRef.doc(id).update({
            "value": newDataValue,
            "last_update": getNowDate()
        }).then(() => {

            // update device field for timestamp
            dataRef.doc(id).get()
            .then(doc => {
                const data: any = doc.data();
                const id_device = data['id_device'];

                deviceRef.doc(id_device).update({
                    "last_update": getNowDate()
                }).then().catch();
            }).catch();

        }).then(() => {
            
            // add new data to logging database
            const logDataInput : LogData = {
                "id_data": id,
                "value": newDataValue,
                "timestamp": getNowDate()
            };
            logRef.add(logDataInput).then().catch();

            res.send({
                "code": 204,
                "msg": "success",
                "success": true,
                "result": "data value updated"
            });

        }).catch(err => {
            res.status(400).send({
                "code": 400,
                "msg": "fail to update data, wrong parameters",
                "success": false,
                "result": err
            });
        });
        
        return;
    }

    // update using device id and data name
    dataRef.where('id_device', '==', dataDeviceId)
        .where('name', '==', dataName).get()
        .then(snapshot => {
            let dataId = "";

            snapshot.forEach(doc => {
                dataId = doc.id;
            });

// ///////////////////////////////// logging system /////////////////////////////////
//             let oldData: any;
//             dataRef.doc(dataId).get().then(doc => {
//                 oldData = doc.data();
                
//                 const logRef = db.collection(dataLogCollections);
//                 const logDataInput : LogData = {
//                     "id_data": dataId,
//                     "value": oldData['value'],
//                     "timestamp": oldData['last_update']
//                 }
//                 logRef.add(logDataInput).then().catch();
//             }).catch();        
// //////////////////////////////////////////////////////////////////////////////////

            // update data value and timestamp
            dataRef.doc(dataId).update({
                "value": newDataValue,
                "last_update": getNowDate()
            }).then().catch();

            // update device timestamp
            deviceRef.doc(dataDeviceId).update({
                "last_update": getNowDate()
            }).then().catch();

            // add new data to logging database
            const logDataInput : LogData = {
                "id_data": dataId,
                "value": newDataValue,
                "timestamp": getNowDate()
            };
            logRef.add(logDataInput).then().catch();

            res.send({
                "code": 204,
                "msg": "success",
                "success": true,
                "result": "data value updated"
            });
        })
        .catch(err => {
            res.status(400).send({
                "code": 400,
                "msg": "fail to update data, wrong parameters",
                "success": false,
                "result": err
            });
        });
});

// 3.5. Update Data's data using id (only name)
app.post('/Data/UpdateName', async (req, res) => {
    const dataRef = db.collection(dataCollections);
    
    const dataId = req.body['id'];
    const newName = req.body['name'];

    dataRef.doc(dataId).update({
        "name": newName,
        "last_update": getNowDate()
    })
    .then(() => {
        res.send({
            "code": 204,
            "msg": "success",
            "success": true,
            "result": "data name updated"
        });
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "fail to update data name, wrong parameters",
            "success": false,
            "result": err
        });
    })
});

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

// 4. (D)elete

// 4.1. Delete user only
app.post('/User/Delete', async (req, res) => {
    const userRef = db.collection(userCollections);
    const userId = req.body['id'];

    userRef.doc(userId).delete()
    .then(() => {
        res.send({
            "code": 200,
            "msg": "success",
            "success": true,
            "result": "user has been deleted"
        });
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "failed",
            "success": false,
            "result": err
        });
    })
});

// 4.2. Delete user and all devices and datas
app.post('/User/DeleteWithData', async (req, res) => {
    const userRef = db.collection(userCollections);
    const deviceRef = db.collection(deviceCollections);
    const dataRef = db.collection(dataCollections);
    
    const userId = req.body['id'];
    let deviceId = "";
    let dataId = "";

    userRef.doc(userId).get()
    .then(() => {
        deviceRef.where('id_user', '==', userId).get()
        .then(result => {

            // get all devices
            result.forEach(devices => {
                deviceId = devices.id;
                dataRef.where('id_device', '==', deviceId).get()
                .then(result2 => {

                    // get all datas
                    result2.forEach(datas => {
                        dataId = datas.id;
                        dataRef.doc(dataId).delete().then().catch();
                    });

                }).catch();

                deviceRef.doc(deviceId).delete().then().catch();
            });

        }).catch();

        userRef.doc(userId).delete()
        .then(() => {
            res.send({
                "code": 200,
                "msg": "success",
                "success": true,
                "result": "user has been deleted"
            });
        })
        .catch();
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "failed",
            "success": false,
            "result": err
        });
    })
});

// 4.3. Delete a device
app.post('/Device/Delete', async (req, res) => {
    const deviceRef = db.collection(deviceCollections);
    const deviceId = req.body['id'];

    deviceRef.doc(deviceId).delete()
    .then(() => {
        res.send({
            "code": 200,
            "msg": "success",
            "success": true,
            "result": "device has been deleted"
        });
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "failed",
            "success": false,
            "result": err
        });
    })
});

// 4.1. Delete a data (a sensor of a device)
app.post('/Data/Delete', async (req, res) => {
    const dataRef = db.collection(dataCollections);
    const dataId = req.body['id'];

    dataRef.doc(dataId).delete()
    .then(() => {
        res.send({
            "code": 200,
            "msg": "success",
            "success": true,
            "result": "sensor/data has been deleted"
        });
    })
    .catch(err => {
        res.status(400).send({
            "code": 400,
            "msg": "failed",
            "success": false,
            "result": err
        });
    })
});


//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

// 5. Other

// 5.1. Login User
/**
 * @param email string
 * @param password string
 */
app.post('/User/Login', async (req, res) => {
    const userEmail = req.body['email'];
    const userPassword = req.body['password'];
    const userRef = db.collection(userCollections);
    
    try {
        const newPass = md5Hash(userPassword);
        
        userRef.where('email', '==', userEmail)
                .where('password', '==', newPass)
                .get()
            .then(snapshot => {

                // user not found, wrong email/password
                if (snapshot.empty) {
                    res.send({
                        "code": 400,
                        "msg": "failed",
                        "success": false,
                        "result": "Incorrect email address or password"
                    });
                    return;
                }

                let userId = "";

                // correct email and password
                snapshot.forEach(doc => {
                    userId = doc.id;

                    userRef.doc(userId).update({
                        "last_login": getNowDate()
                    }).then(() => {
                        res.send({
                            "code": 200,
                            "msg": "success",
                            "success": true,
                            "result": "ok"
                        });
                    }).catch();
                })
            })
            .catch(err => {
                res.send({
                    "code": 400,
                    "msg": "failed",
                    "success": false,
                    "result": "Wrong parameters"
                });
        });
    } catch (error) {
        res.send({
            "code": 400,
            "msg": "error while getting data",
            "success": false,
            "result": {}
        });
    }
});

// 5.2. Check session login
app.post('/User/CheckSessionLogin', (req, res) => {
    const userRef = db.collection(userCollections);
    const id = req.body['id'];

    let last_login = "";
    const now_login = getNowDate();

    userRef.doc(id).get()
        .then(doc => {
            const userData: any = doc.data();
            last_login = userData['last_login'];

            if (last_login === "") {
                res.send({
                    "status": false
                });
                return;
            }

            // session login timeout time = 1 hours = 60 mins = 3600 secs = 3600000 milisecs.
            const SESSION_TIMEOUT = 3600000;
            const last_login_time = convertToDate(last_login).getTime();
            const now_login_time = convertToDate(now_login).getTime();
            const diff_time = now_login_time - last_login_time;

            if (diff_time > SESSION_TIMEOUT) {
                res.send({
                    "status": false
                });
            } else {
                res.send({
                    "status": true
                });
                
                // update last login time
                userRef.doc(id).update({
                    "last_login": getNowDate()
                }).then().catch();
            }
        })
        .catch(err => {
            res.send({
                "status": null,
                "msg": err
            });
        })
})

// 5.3. Logout user
app.post('/User/Logout', async (req, res) => {
    const userId = req.body['id'];
    const userRef = db.collection(userCollections);
    
    try {        
        userRef.doc(userId).get()
            .then(snapshot => {
                const userData: any = snapshot.data();
                const last_login = userData['last_login'];

                if (last_login === "") {
                    res.send({
                        "code": 400,
                        "msg": "failed",
                        "success": false,
                        "result": "User hasn't logged in"
                    });
                    return;
                }

                // delete last login time
                userRef.doc(userId).update({
                    "last_login": ""
                })
                .then(() => {
                    res.send({
                        "code": 200,
                        "msg": "success",
                        "success": true,
                        "result": "ok"
                    });
                }).catch();
            })
            .catch(err => {
                res.send({
                    "code": 400,
                    "msg": "failed",
                    "success": false,
                    "result": "Wrong parameters"
                });
        });
    } catch (error) {
        res.send({
            "code": 400,
            "msg": "error while getting data",
            "success": false,
            "result": {}
        });
    }
});

// 5.4. Update session login
app.post('/User/UpdateSessionLogin', async (req, res) => {
    const userId = req.body['id'];
    const userRef = db.collection(userCollections);

    userRef.doc(userId).update({
        "last_login": getNowDate()
    }).then(() => {
        res.send({
            "code": 200,
            "msg": "success",
            "success": true,
            "result": "ok"
        });
    }).catch(err => {
        res.send({
            "code": 400,
            "msg": "failed",
            "success": false,
            "result": "Cannot update user session login"
        });
    });
});


//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

// 6. Logging

// 6.1. Get log data
app.get('/Log/:id_data', (req, res) => {
    const logRef = db.collection(dataLogCollections);
    const id_data = req.params.id_data;

    logRef.where('id_data', '==', id_data).get()
        .then(snapshot => {
            const data: FirebaseFirestore.DocumentData[] = [];

            // if no collection found
            if (snapshot.empty) {
                res.send({
                    "code": 404,
                    "msg": "no log data is found",
                    "success": false,
                    "result": []
                });
                return;
            }  
        
            // collection found, get all documents
            snapshot.forEach(doc => {
                const getData = doc.data();
                data.push({
                    "value": getData['value'],
                    "timestamp": convertToDate(getData['timestamp'])
                });
            });
            res.send({
                "code": 200,
                "msg": "success",
                "success": true,
                "id_data": id_data,
                "result": data
            });
        })
        .catch(err => {
            res.send({
                "code": 400,
                "msg": "error while fetching log data",
                "success": false,
                "result": []
            });
        });
});

export { app };