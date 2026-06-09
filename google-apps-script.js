// =========================================================================
// GOOGLE APPS SCRIPT DATABASE CODE (สำหรับคัดลอกไปวางใน Apps Script)
// =========================================================================
// ขั้นตอนการใช้งาน:
// 1. เปิด Google Sheets -> ส่วนขยาย (Extensions) -> Apps Script
// 2. ลบโค้ดเริ่มต้นทั้งหมด แล้ววางโค้ดชุดนี้ลงไปแทน
// 3. กดบันทึก (แผ่นดิสก์)
// 4. กด "ทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้ใหม่" (New deployment)
// 5. ตั้งค่าผู้มีสิทธิ์เข้าถึงเป็น "ทุกคน" (Anyone) แล้วกด Deploy จากนั้นคัดลอก Web App URL
// =========================================================================

const SHEET_NAME = "Bookings";

function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  
  try {
    const sheet = getOrCreateSheet();
    
    // 1. ดึงข้อมูลที่นั่งที่ถูกจองทั้งหมด
    if (action === "get") {
      const data = sheet.getDataRange().getValues();
      const bookings = [];
      if (data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          bookings.push({
            name: data[i][0],
            email: data[i][1],
            company: data[i][2],
            seatId: data[i][3],
            serial: data[i][4]
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: bookings }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    
    // 2. บันทึกข้อมูลการเลือกที่นั่ง (ป้องกันการเลือกซ้ำแบบ Real-time)
    else if (action === "save") {
      const name = params.name;
      const email = params.email;
      const company = params.company;
      const seatId = params.seatId;
      const serial = params.serial;
      const timestamp = new Date();
      
      if (!name || !seatId) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing name or seatId" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const data = sheet.getDataRange().getValues();
      let seatTaken = false;
      let nameRowIndex = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][3] === seatId && data[i][0] !== name) {
          // หากคนจองไม่ใช่ Admin/Tester ให้ตรวจสอบสิทธิ์การชนของที่นั่ง
          if (!isAdminOrTester(name)) {
            seatTaken = true;
            break;
          }
        }
        if (data[i][0] === name) {
          nameRowIndex = i + 1; // ลำดับแถวใน Sheet (เริ่มจาก 1)
        }
      }
      
      if (seatTaken) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Seat already taken by someone else" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (nameRowIndex > -1) {
        // อัปเดตข้อมูลแถวเดิมหากจองซ้ำ
        sheet.getRange(nameRowIndex, 1, 1, 6).setValues([[name, email, company, seatId, serial, timestamp]]);
      } else {
        // บันทึกแถวใหม่
        sheet.appendRow([name, email, company, seatId, serial, timestamp]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. ลบการจองของผู้ใช้ที่ระบุ (สำหรับปุ่มแอดมินลบการเลือกที่นั่ง)
    else if (action === "delete") {
      const name = params.name;
      if (!name) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing name" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = sheet.getDataRange().getValues();
      let rowDeleted = false;
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === name) {
          sheet.deleteRow(i + 1);
          rowDeleted = true;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", rowDeleted: rowDeleted }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. ล้างตารางที่นั่งจองทั้งหมด
    else if (action === "clearAll") {
      const rows = sheet.getLastRow();
      if (rows > 1) {
        sheet.deleteRows(2, rows - 1);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันระบุชื่อ Admin / Tester เพื่อยกเว้นเงื่อนไขเช็คสิทธิ์จองทับซ้อนสำหรับทดสอบระบบ
function isAdminOrTester(name) {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return lowerName.includes('admin') || lowerName.includes('tester') || lowerName.includes('thanakrit') || lowerName.includes('krittiya') || lowerName.includes('prapavadee');
}

// ช่วยดึงหรือสร้างแผ่นงาน "Bookings" หากยังไม่มีในไฟล์ชีต
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Name", "Email", "Company", "SeatId", "Serial", "Timestamp"]);
  }
  return sheet;
}
