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
mongoose.connect('mongodb://localhost:27017/teacher', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
}).then(() => {
    console.log("Connected to teacher DB");
}).catch(err => {
    console.error("Failed to connect to teacher DB:", err);
});

const attendanceDb = mongoose.connection.useDb('attendance');


// Define Mongoose models
const ClassValue = mongoose.model('DropdownValue', { value: String }, 'class');
const SubjectValue = mongoose.model('SubjectValue', { value: String }, 'subject');
const RoomValue = mongoose.model('RoomValue', { value: String }, 'room');

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


  // Endpoint to fetch all dropdown values
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
    } catch (error) {
      console.error("Error in /get-subject-values:", error);
      res.status(500).send({ success: false, error: error.message });
    
    }
  });
  
  app.get('/get-room-values', async (req, res) => {
    try {
      const values = await RoomValue.find();
      res.status(200).send({ success: true, data: values });
    } catch (error) {
      console.error("Error in /get-subject-values:", error);
      res.status(500).send({ success: false, error: error.message });
    
    }
  });

app.get('/attendance', async (req, res) => {
    const { subjectId, batchValue, month } = req.query;

    try {
        // Use mongoose.connection to fetch the class
        const batch = await mongoose.connection.collection('class').findOne({ value: batchValue });

        // Check if batch is null
        if (!batch) {
            return res.status(400).send(`No batch found for value: ${batchValue}`);
        }

        const studentUsernames = batch.students;

        const attendanceData = await attendanceDb.collection('studattens')
            .find({ 
                "username": { $in: studentUsernames },
                "subjects.subjectID": subjectId
            })
            .toArray();

        const refinedData = attendanceData.map(student => {
            const subject = student.subjects.find(s => s.subjectID === subjectId);
                
            if(!subject) {
                console.error('Subject not found for student:', student.username);
                return null;  // or return some default structure
            }
        
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
        }).filter(item => item !== null);  // filter out any null values
            
        res.json(refinedData);
    } catch (error) {
        console.error("Error in /attendance:", error); 
        res.status(500).send('Error fetching attendance data');
    }
});

// TODO: Add routes

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
