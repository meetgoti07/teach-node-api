const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Expo } = require('expo-server-sdk');

let expo = new Expo();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb+srv://meetgoti07:Itsmg.07@cluster0.nr24cb3.mongodb.net/teacher', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log("Connected to teacher DB"))
.catch(err => console.error("Failed to connect to teacher DB:", err));

const ClassSchema = new mongoose.Schema({
    value: String,
    students: [{
        rollno: String,
        expoToken: String
    }]
});

const Class = mongoose.model('Class', ClassSchema, 'class');
const ClassValue = mongoose.model('ClassValue', { value: String }, 'class');
const SubjectValue = mongoose.model('SubjectValue', { value: String }, 'subject');
const RoomValue = mongoose.model('RoomValue', { value: String }, 'room');

const attendanceDb = mongoose.createConnection('mongodb+srv://meetgoti07:Itsmg.07@cluster0.nr24cb3.mongodb.net/attendance', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Student = attendanceDb.model('Student', new mongoose.Schema({
    username: String,
    subjects: [{
        subjectID: String,
        attendance: [{
            date: Date,
            status: String
        }]
    }]
}, 'studattens'));

app.post('/send-notification', async (req, res) => {
    const { batch, message, title } = req.body;

    if (!batch || !message || !title) {
        return res.status(400).send('Batch, message, and title are required.');
    }

    try {
        const batchDocument = await Class.findOne({ value: batch });

        if (!batchDocument || !Array.isArray(batchDocument.students)) {
            return res.status(400).send('Batch not found or no students in batch.');
        }

        const pushTokens = batchDocument.students
            .map(s => s.expoToken)
            .filter(Boolean);

        if (pushTokens.length === 0) {
            return res.status(400).send('No valid Expo tokens for the given batch.');
        }

        let notifications = pushTokens.map(token => ({
            to: token,
            sound: 'default',
            title: title,
            body: message,
            data: { title, message },
        }));

        const chunks = expo.chunkPushNotifications(notifications);
        let tickets = [];

        for (let chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error while sending chunk', error);
            }
        }

        return res.send({ success: true, tickets });
    } catch (error) {
        console.error('Error in /send-notification:', error);
        return res.status(500).send('Internal Server Error');
    }
});

// The rest of your endpoints...

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
    } catch (error){
      console.error("Error in /get-subject-values:", error);
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
        const batch = await Class.findOne({ value: batchValue });

        if (!batch || !Array.isArray(batch.students)) {
            return res.status(400).send('Batch not found or no students in batch.');
        }

        const studentRollNumbers = batch.students.map(student => student.rollno);

        const attendanceData = await Student.find({
            "username": { $in: studentRollNumbers },
            "subjects.subjectID": subjectId
        });

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
