const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
let expo = new Expo();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);

// Connect to MongoDB
mongoose.connect('mongodb+srv://meetgoti07:Itsmg.07@cluster0.nr24cb3.mongodb.net/teacher', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
}).then(() => {
    console.log("Connected to teacher DB");
}).catch(err => {
    console.error("Failed to connect to teacher DB:", err);
});

const attendanceDb = mongoose.connection.useDb('attendance');

// Mongoose models
const ClassValue = mongoose.model('DropdownValue', { value: String }, 'class');
const SubjectValue = mongoose.model('SubjectValue', { value: String }, 'subject');
const RoomValue = mongoose.model('RoomValue', { label: String, value: String}, 'room');

const Student = attendanceDb.model('Student', new mongoose.Schema({
  username: String,
  subjects: [{
      subjectID: String,
      attendance: [{
          date: Date,
          status: String
      }]
  }]
}), 'studattens');


app.post('/send-notification', async (req, res) => {
    const { batch, message, title } = req.body;

    if (!batch || !message || !title) {
        console.log("1");
        return res.status(400).send('Batch, message, and title are required.');
    }

    // Fetch the students for this batch
    const batchDocument = await mongoose.connection.collection('class').findOne({ value: batch });
    if (!batchDocument) {
        console.log("2");
        return res.status(400).send('Batch not found.');
    }

    const pushTokens = batchDocument.students.map(s => s.expoToken).filter(Boolean);
    console.log(pushTokens);

    // Construct the message
    let notifications = [];
    for (let pushToken of pushTokens) {
        if (!Expo.isExpoPushToken(pushToken)) {
            console.log("3");
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            continue;
        }

        notifications.push({
            to: pushToken,
            sound: 'default',
            title: title,
            body: message,
            data: { title, message },
        });
    }

    let chunks = expo.chunkPushNotifications(notifications);
    console.log(chunks);
    let tickets = [];
    for (let chunk of chunks) {
        try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }
        catch{console.log("ERROR")};
    }

    res.send({ success: true, tickets });
});

// Endpoint to update expoToken for a student in a specific class
app.post('/update-expo-token', async (req, res) => {
    const { rollno, expoToken } = req.body;

    if (!rollno || !expoToken) {
        return res.status(400).send("Roll number and expoToken are required");
    }

    try {
        const result = await mongoose.connection.collection('class').updateMany(
            { "students.rollno": rollno },
            { $set: { "students.$.expoToken": expoToken } }
        );

        if (result.modifiedCount > 0) {
            res.status(200).send({ success: true, message: "Token updated successfully." });
        } else {
            res.status(400).send({ success: false, message: "Unable to update the token. Check the roll number." });
        }
    } catch (error) {
        console.error("Error in /update-expo-token:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});


// Other endpoints
app.get('/get-class-values', async (req, res) => {
    try {
      const values = await ClassValue.find();
      res.status(200).send({ success: true, data: values });
    } catch (error) {
      res.status(500).send({ success: false, error: error.message });
    }
});

app.get('/get-subject-values', async (req, res) => {
    try {
      const values = await SubjectValue.find();
      res.status(200).send({ success: true, data: values });
    } catch (error){console.error("Error in /get-subject-values:", error);
      res.status(500).send({ success: false, error: error.message });
    }
});

app.get('/get-room-values', async (req, res) => {
    try {
      const values = await RoomValue.find();
      res.status(200).send({ success: true, data: values });
    } catch (error) {
      console.error("Error in /get-room-values:", error);
      res.status(500).send({ success: false, error: error.message });
    }
});

app.get('/attendance', async (req, res) => {
    const { subjectId, batchValue, month } = req.query;

    try {
        const batch = await mongoose.connection.collection('class').findOne({ value: batchValue });
        const studentRollNumbers = batch.students.map(student => student.rollno);

        const attendanceData = await attendanceDb.collection('studattens')
            .find({ 
                "username": { $in: studentRollNumbers },
                "subjects.subjectID": subjectId
            })
            .toArray();

        const refinedData = attendanceData.map(student => {
            const subject = student.subjects.find(s => s.subjectID === subjectId);
            return {
                username: student.username,
                attendance: subject.attendance.filter(att => {
                    let dateToCheck;
                    if(att.date instanceof Date) {
                        dateToCheck = att.date;
                    } else if(att.date && att.date.$date) {
                        dateToCheck = new Date(att.date.$date);
                    } else {
                        console.error('Invalid date structure for student:', student.username);
                        return false;  // exclude this record
                    }
                    return dateToCheck.getMonth() === month - 1;
                })
            };
        }).filter(item => item !== null);
        res.json(refinedData);
    } catch (error) {
        console.error("Error in /attendance:", error); 
        res.status(500).send('Error fetching attendance data');
    }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
