const path = require('path');
const express = require('express');
const session = require('express-session');
const hbs = require('hbs');
const bodyParser = require('body-parser');
const fs = require('fs');
const formidable = require('formidable');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const mysql = require('mysql');
const dateformat = require('dateformat');
const md5 = require('md5');
const app = express();

app.set('views',path.join(__dirname,'views'));
app.set('view engine', 'hbs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/assets',express.static(__dirname + '/public'));
app.use('/uploads', express.static('uploads'));
app.use(session({secret: 'sMaNd4k49'}));

var sess;

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'absensi_db'
  });
   
conn.connect((err) =>{
    if(err) throw err;
    console.log('Mysql Connected...');
});

checkRecord();

function daysInMonth(month, year){
    return new Date(month, year, 0).getDate();
}

function getWeekend(getTot){
    var d = new Date();
    var week = new Array();

    for(var i=1;i<=getTot;i++){
        var newDate = new Date(d.getFullYear(),d.getMonth(),i)
        if(newDate.getDay()==0 || newDate.getDay()==6){
            week.push(i);
        }
    }
    return week;
}

function createRecord(rec, y, m){
    let count = daysInMonth(y, m);
    var full_date = "";

    for(i=1; i<=count; i++){
        if(i != count){
            full_date += " day"+i.toString()+" varchar(1) DEFAULT 'Z',";
        }else{
            full_date += " day"+i.toString()+" varchar(1) DEFAULT 'Z')";
        }
    }
    let sql = "CREATE TABLE "+ rec + " (induk varchar(20) UNIQUE,"+full_date;
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
    });

    let sql2 = "INSERT INTO "+ rec +" (induk) SELECT induk FROM user";
    let query2 = conn.query(sql2, (err, results) => {
        if(err) throw err;
    });

    var week = getWeekend(count);
    var q = "";
    for(i=0; i<week.length; i++){
        if(i != week.length-1){
            q += " day"+week[i].toString()+" ='L',";
        }else{
            q += " day"+week[i].toString()+" ='L'";
        }
    }
    
    let sql3 = "UPDATE "+ rec +" SET"+q;
    let query3 = conn.query(sql3, (err, results) => {
        if(err) throw err;
    });
}

function checkRecord(){
    var date = new Date();
    var year = date.getFullYear();
    var month = (date.getMonth())+1;
    rec = 'record_'+month.toString()+'_'+year.toString();
    let sql = "SHOW TABLEs LIKE '"+ rec +"'";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        var i = results.length;
        if(i == 0){
            console.log('Create Table Record');
            createRecord(rec, year, month);
        }else{
            console.log('Record table for this month is already created');
        }
    });
}

function getAccessTime(){
    return new Promise(resolve => {
        let sql = "SELECT * FROM time";
        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
            resolve(results);
        });
    });
}

function getHoliday(){
    return new Promise(resolve => {
        let sql = "SELECT * FROM holiday";
        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
            resolve(results);
        });
    });
}

async function checkAttend(){
    var d = new Date();
    if(d.getDay() == 0 || d.getDay() == 6){
        return false;
    }else{
        arr_ = await getHoliday();
        holiday = [];
        for(i=0; i<arr_.length; i++){
            holiday.push(arr_[i].tgl);
        }
        if(d.getDate() < 10){
            now = "0"+d.getDate().toString();    
        }else{
            now = d.getDate().toString();
        }
        if((d.getMonth()+1) < 10){
            now += "/0"+(d.getMonth()+1).toString()+"/"+d.getFullYear().toString()
        }else{
            now += "/"+(d.getMonth()+1).toString()+"/"+d.getFullYear().toString();
        }
        if(holiday.includes(now)){
            return false;
        }else{
            hour = d.getHours();
            minute = d.getMinutes();

            acc = await getAccessTime();
            temp = acc[0].from_time.split(":");
            from_time = [];
            from_time.push(parseInt(temp[0]));
            from_time.push(parseInt(temp[1]));

            temp = acc[0].until_time.split(":");
            until_time = [];
            until_time.push(parseInt(temp[0]));
            until_time.push(parseInt(temp[1]));
            
            if(hour < from_time[0] || (hour == from_time[0] && minute < from_time[1])){
                return false;
            }else{
                if(hour > until_time[0] || (hour == until_time[0] && minute > until_time[1])){
                    return false;
                }else{
                    return true;
                }
            }
        }
    }
}

function isAttend(induk){
    return new Promise(resolve => {
        var date = new Date();
        var year = date.getFullYear();
        var month = (date.getMonth())+1;
        rec = 'record_'+month.toString()+'_'+year.toString();

        let sql = "SELECT day"+ date.getDate() + " FROM "+rec+" WHERE induk='"+induk+"'";

        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
            let a = results[0]["day"+date.getDate()];
            if(a == 'H'){
                resolve(true);
            }else{
                resolve(false);
            }
        });
    });
}

function getPeriode(){
    return new Promise(resolve => {
        let sql = "SHOW TABLES LIKE '%record%'";
        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
            resolve(results);
        });
    });
}

function getAbsen(induk, periode){
    return new Promise(resolve => {
        let sql = "SELECT * FROM "+ periode + " WHERE induk="+induk;
        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
            resolve(results);
        });
    });
}

app.post('/login', function (req, res ) {
    sess = req.session;

    induk = req.body.username;
    pwd = req.body.password;

    let sql = "SELECT * from user WHERE induk='"+induk+"' AND pwd='"+pwd+"'";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        if(results.length == 0){
            res.render('login', {'dialog' : 'No Induk atau Password Salah'});
        }else if(results.length > 1){
            res.render('login', {'dialog' : 'Login Error'});
        }else{
            sess.induk = results[0].induk;
            sess.name = results[0].name;
            sess.id_kelas = results[0].id_kelas;
            sess.tipe = results[0].tipe;

            if(results[0].tipe == 0){
                sess.permission = false;
            }else{
                sess.permission = true;
            }
            res.redirect('/home');
        }
    });
});

app.post('/login-adm', (req, res )=> {
    sess = req.session;

    adm = req.body.username;
    pwd = req.body.password;

    let sql = "SELECT * from admin WHERE adm='"+adm+"' AND pwd='"+md5(pwd)+"'";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        if(results.length == 0){
            res.render('login-adm', {'dialog' : 'Password Salah'});
        }else if(results.length > 1){
            res.render('login-adm', {'dialog' : 'Login Error'});
        }else{
            sess.adm = results[0].adm;

            res.redirect('/admin');
        }
    });
});

app.get('/logout',(req, res) => {
    req.session.destroy((err) => {
        if(err) {
            return console.log(err);
        }
        res.redirect('/');
    });
});

app.post('/pwd', (req, res) => {
    sess = req.session;
  
    let sql = "UPDATE user SET pwd='"+req.body.new+"' WHERE induk="+sess.induk;
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.status(200).json(true);
    });
})

app.get('/get_status', async function (req, res) {
    sess = req.session;
    var periode = await getPeriode();
    var all_recap = {};
    all_recap.hadir = 0;
    all_recap.absen = 0;
    all_recap.izin = 0;
    all_recap.sakit = 0;
    
    for(i=0; i<periode.length; i++){
        var resp = await getAbsen(sess.induk, periode[i]["Tables_in_absensi_db (%record%)"]);
        // Z default
        // L libur
        // A absen
        // I izin
        // S Sakit
        // H hadir
        for(var key in resp[0]){
            value = resp[0][key];
            if(value.length == 1){
                if(value == 'H'){
                    all_recap.hadir += 1;
                }else if(value == 'A'){
                    all_recap.absen += 1;
                }else if(value == 'I'){
                    all_recap.izin += 1;
                }else if(value == 'S'){
                    all_recap.sakit += 1;
                }
            }
        }
    }
    res.json({
        'name' : sess.name,
        'kelas' : sess.id_kelas,
        'induk' : sess.induk,
        'hadir' : all_recap.hadir,
        'sakit' : all_recap.sakit,
        'izin' : all_recap.izin,
        'absen' : all_recap.absen
    })
});

app.get('/get_classmate', async function(req, res){
    sess = req.session;
    var date = new Date();
    var year = date.getFullYear();
    var month = (date.getMonth())+1;
    rec = 'record_'+month.toString()+'_'+year.toString();

    let sql = "SELECT user.name, "+ rec +".day"+date.getDate()+" FROM user INNER JOIN "+rec+" ON user.induk="+rec+".induk WHERE user.id_kelas='"+sess.id_kelas+"'";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.json(results);
    });
});

app.get('/confirm_attend', function(req,res){
    sess = req.session;
    var date = new Date();
    var year = date.getFullYear();
    var month = (date.getMonth())+1;
    rec = 'record_'+month.toString()+'_'+year.toString();

    let sql = "UPDATE "+rec+" SET day"+ date.getDate() +"='H' WHERE induk="+sess.induk;
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        sess.attend = true;
        res.status(200).json(true);
    });
});

app.get('/',(req, res) => {
    sess = req.session;

    if(sess.induk){
        res.redirect('/home');
    }else{
        res.render('login');
    }
});

app.get('/home',async function(req, res) {
    sess = req.session;
    if(sess.induk){
        var filesPath = path.join(__dirname, 'uploads/');
        fs.readdir(filesPath, function (err, files) {
            if (err) {
                console.log(err);
                return;
            }
            files.forEach(function (file) {
                fs.stat(filesPath + file, function (err, stats) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    var createdAt = Date.parse(stats.ctime),
                        days = Math.round((Date.now() - createdAt) / (1000*60*60*24));

                    if (days > 1) {
                        fs.unlink(filesPath + file);
                    }
                });
            });
        });
        res.render('home', {
            "attend" : await isAttend(sess.induk), 
            "permission" : sess.permission,
            "access" : await checkAttend()
        });
    }else{
        res.redirect('/')
    }
});

app.get('/admin',(req, res) => {
    sess = req.session;

    if(sess.adm){
        res.render('admin');
    }else{
        res.render('login-adm');
    }
});

app.get('/get_periode', (req, res) => {
    let sql = "SHOW TABLES LIKE '%record%'";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.json(results);
    });
});

app.get('/get_class', (req, res) =>{
    let sql = "SELECT * FROM class";
    let query = conn.query(sql, (err, re) => {
        if(err) throw err;
        var all = [];
        var angkatan = [];
        var jurusan = [];
        var kelas = [];
        var class_parsing = {};
        
        for(i=0; i<re.length; i++){
            all.push(re[i].nama_kelas);
            arr = re[i].nama_kelas.split("-");
            if(angkatan.includes(arr[0]) == false){
                angkatan.push(arr[0]);
            }
        }
        for(i=0; i<re.length; i++){
            arr = re[i].nama_kelas.split("-");
            if(angkatan.includes(arr[0]) && jurusan.includes(arr[1]) == false){
                jurusan.push(arr[1]);
            }
        }
        for(i=0; i<re.length; i++){
            arr = re[i].nama_kelas.split("-");
            if(jurusan.includes(arr[1]) && kelas.includes(arr[2]) == false){
                kelas.push(arr[2]);
            }
        }
        class_parsing.angkatan = angkatan;
        class_parsing.jurusan = jurusan;
        class_parsing.kelas = kelas;
        class_parsing.all = all;

        res.json(class_parsing);
    });
});

app.post('/read_recap', (req, res) =>{
    let sql = "SELECT user.name, record_"+req.body.month+"_"+req.body.year+".* FROM user INNER JOIN record_"+req.body.month+"_"+req.body.year+" ON user.induk=record_"+req.body.month+"_"+req.body.year+".induk WHERE user.id_kelas='"+req.body.id_kelas+"'";
    let query = conn.query(sql, (err, results) => {
        if(err) res.status(200).json(false);
        res.json(results);
    });
});

app.post('/read_surat',(req, res) =>{
    var conf = [];
    if(req.body.confirm != ""){
        conf = req.body.confirm.split("|");
    }
    let txt = "(";
    for(i=0; i<conf.length; i++){
        if(i != conf.length-1){
            txt += conf[i].toString() + ",";
        }else{
            txt += conf[i].toString() + ")";
        }
    }
    if(conf.length != 0){
        let sql = "SELECT * FROM surat WHERE confirm IN "+ txt +" ORDER BY id DESC";
        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
            res.json(results);
        });
    }else{
        res.json({});
    }
});

app.post('/update_access_time',(req, res) => {
    let sql = "UPDATE time SET from_time='"+req.body.from_time+"', until_time='"+req.body.until_time+"' WHERE id=1";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.status(200).json(true);
    });
});

app.post('/read_access_time',async function(req, res) {
    res.json(await getAccessTime());
});

app.post('/create_holiday',(req, res) => {
    let sql = "INSERT INTO holiday SET ?";
    let data = {};
    data.tgl = req.body.tgl;
    let query = conn.query(sql, data,(err, results) => {
        if(err) throw err;
        res.status(200).json(true);
    });
});

app.post('/read_holiday',async function(req, res) {
    res.json(await getHoliday());
});

app.post('/delete_holiday',(req, res) => {
    let sql = "DELETE FROM holiday WHERE id="+req.body.id+"";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.status(200).json(true);
    });
});

app.post('/update_surat',(req, res) => {
    let sql = "UPDATE surat SET confirm="+req.body.type+" WHERE id="+req.body.id;
    let query = conn.query(sql, (err, results) => {
      if(err) throw err;
      res.json(results);
    });
});

app.post('/upload_surat', function (req, res) {
    var photos = [],
        form = new formidable.IncomingForm();

    form.multiples = true;
    form.uploadDir = path.join(__dirname, 'tmp_uploads');
    
    form.on('file', function (name, file) {
        if (photos.length === 3) {
            fs.unlink(file.path);
            return true;
        }

        var buffer = null,
            type = null,
            filename = '';

        buffer = readChunk.sync(file.path, 0, 262);
        type = fileType(buffer);

        if (type !== null && (type.ext === 'png' || type.ext === 'jpg' || type.ext === 'jpeg')) {
            
            filename = Date.now() + '-' + file.name.replace(/\s+/g, '');
            fs.rename(file.path, path.join(__dirname, 'uploads/' + filename));
            photos.push({
                status: true,
                filename: filename,
                type: type.ext,
                publicPath: 'uploads/' + filename
            });
        }else{
            photos.push({
                status: false,
                filename: file.name,
                message: 'Invalid file type'
            });
            fs.unlink(file.path);
        }
    });
    form.parse(req, function (err, fields, files) {
        res.status(200).json(true);
        
        dataSurat = {};
        image = "";
        
        for(i=0;i<photos.length;i++){
            if(i != photos.length-1){
                image += photos[i].filename + "|";
            }else{
                image += photos[i].filename;
            }
                
        }

        dataSurat.image = image;
        dataSurat.text = fields.text;
        dataSurat.subject = fields.subject;
        dataSurat.from_date = fields.from_date;
        dataSurat.to_date = fields.to_date;
        dataSurat.to_name = fields.to_name;
        dataSurat.from_name = "Testing";
        dataSurat.confirm = 0;
        dataSurat.date_submit = dateformat(new Date(), "hh:MM-dd/mm/yyyy");

        let sql = "INSERT INTO surat SET ?";
        let query = conn.query(sql, dataSurat,(err, results) => {
            if(err) throw err;
        });
    });
});

app.post('/upload_lapor', function (req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        dataSurat = {};

        dataSurat.image = "";
        dataSurat.text = fields.text;
        dataSurat.subject = fields.subject;
        dataSurat.from_date = fields.from_date;
        dataSurat.to_date = fields.to_date;
        dataSurat.to_name = fields.to_name;
        dataSurat.from_name = "Testing";
        dataSurat.confirm = 0;
        dataSurat.date_submit = dateformat(new Date(), "hh:MM-dd/mm/yyyy");

        let sql = "INSERT INTO surat SET ?";
        let query = conn.query(sql, dataSurat,(err, results) => {
            if(err) throw err;
            res.status(200).json(true);
        });
    });
});

app.post('/upload_siswa', function (req, res) {
    var photos = [],
        form = new formidable.IncomingForm();

    form.multiples = true;
    form.uploadDir = path.join(__dirname, 'tmp_uploads');
    
    form.on('file', function (name, file) {
        if (photos.length === 1) {
            fs.unlink(file.path);
            return true;
        }

        var buffer = null,
            type = null,
            filename = '';

        buffer = readChunk.sync(file.path, 0, 20000);
        type = fileType(buffer);

        if (type !== null) {
            filename = "data_siswa";
            fs.rename(file.path, path.join(__dirname, 'uploads/' + filename));
            photos.push({
                status: true,
                filename: filename,
                type: 'csv',
                publicPath: 'uploads/' + filename
            });
        }else{
            photos.push({
                status: false,
                filename: file.name,
                message: 'Invalid file type'
            });
            fs.unlink(file.path);
        }
    });
    form.parse(req, function (err, fields, files) {
        let sql4 = "TRUNCATE TABLE user";
        let query4 = conn.query(sql4, (err, results) => {
            if(err) throw err;
        });

        let sql5 = "TRUNCATE TABLE class";
        let query5 = conn.query(sql5, (err, results) => {
            if(err) throw err;
        });

        let sql = "LOAD DATA LOCAL INFILE '"+ path.join(__dirname, 'uploads/data_siswa') +"' INTO TABLE user FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n'";
        let query = conn.query(sql, (err, results) => {
            if(err) throw err;
        });
        
        let sql2 = "SELECT DISTINCT id_kelas FROM user";
        let query2 = conn.query(sql2, (err, results) => {
            if(err) throw err;
            var kelas = [];
            kelas = results;
            let sql3 = "INSERT INTO class SET ?";
            for(i=0; i<kelas.length; i++){
                let data = {};
                data.nama_kelas = kelas[i].id_kelas;
                let query3 = conn.query(sql3, data,(err, results) => {
                    if(err) throw err;
                });
            }
        });

        res.status(200).json(true);
    });
});

app.get('/read_siswa',(req, res) => {
    let sql = "SELECT * FROM user";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.json(results);
    });
});

app.post('/change_pwd',(req, res) => {
    let sql = "SELECT * FROM user";
    let query = conn.query(sql, (err, results) => {
        if(err) throw err;
        res.json(results);
    });
});

app.listen(8000, () => {
    console.log('Server is running at port 8000');
});