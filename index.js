const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);

// Connect to MongoDB
mongoose.connect('mongodb+srv://[YOUR_MONGO_CREDENTIALS]/teacher', { 
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

// Endpoint to update expoToken for a student in a specific class
app.post('/update-expo-token', async (req, res) => {
    const { rollno, className, expoToken } = req.body;

    if (!rollno || !className || !expoToken) {
        return res.status(400).send("Roll number, class name, and expoToken are required");
    }

    try {
        const result = await mongoose.connection.collection('class').updateOne(
            { "value": className, "students.rollno": rollno },
            { $set: { "students.$.expoToken": expoToken } }
        );

        if (result.modifiedCount === 1) {
            res.status(200).send({ success: true, message: "Token updated successfully." });
        } else {
            res.status(400).send({ success: false, message: "Unable to update the token. Check the roll number and class name." });
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
    } catch (error) kicker      console.error("Error in /get-subject-values:", error);
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
