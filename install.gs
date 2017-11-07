Install = function() {
  this.sheet = SpreadsheetApp.getActive().getSheetByName('report');
  this.startTime = this.sheet.getRange(2, 3).getValue();
  this.endTime = this.sheet.getRange(2, 5).getValue();
  this.os = this.sheet.getRange(2, 7).getValue();
  this.attr_window = this.sheet.getRange(2, 9).getValue();
  this.startTimeStr = Utilities.formatDate(this.startTime, 'JST', 'yyyy-MM-dd');
  this.endTimeStr = Utilities.formatDate(this.endTime, 'JST', 'yyyy-MM-dd');
  this.datasource = 'adjust';
  this.appId = (this.os === 'ios') ? '75043' : '75044';
  this.adId = (this.os === 'ios') ? 'idfa' : 'gps_adid';
  this.table = this.datasource + "." +  this.datasource + "_" + this.appId;
  this.ptCond = "_PARTITIONTIME BETWEEN TIMESTAMP('" + this.startTimeStr + "') AND TIMESTAMP('" + this.endTimeStr + "')";
  this.bq = initBqApi();
}

function initInstall() {
  return new Install();
}

// debug用
function testInstall() {
  return new Install().update();
}

Install.prototype.update = function() {
  this.updateNetworks();
  this.updateInstalls();
  this.updateCvs();
  this.sheet.getRange(6, 2, 100, 4).setBorder(true, true, true, true, true, true)
}

Install.prototype.updateNetworks = function() {
  // organic install count
  var networkQuery = "SELECT" +
  " DISTINCT(network_name) " +
  " FROM " + this.table + 
  " WHERE " + this.ptCond +
  " ORDER BY 1";
 
  var rows = this.bq.executeQuery(networkQuery);
  this.sheet.getRange(7, 2, 1000).clear();
  count = 0
  for(k in rows) {
    row = rows[k];
    this.sheet.getRange(7 + count, 2).setValue(row['f'][0]['v'])
    count++;
  }
}

Install.prototype.updateInstalls = function() {
  var installQuery = "SELECT" +
  " network_name, COUNT(DISTINCT(adId)) " +
  " FROM " + this.table + 
  " WHERE activity_kind = 'install'" + 
  " AND " + this.ptCond +
  " GROUP BY network_name" +
  " ORDER BY 1";
 
  var rows = this.bq.executeQuery(installQuery);
  
  this.sheet.getRange(7, 3, 100).clear();
  var cache_networks = this.sheet.getRange(7, 2, 100).getValues();
    
  for(k in rows) {
    row = rows[k];
    var bq_network = row['f'][0]['v']
    for (i in cache_networks) {
      if(cache_networks[i][0] == bq_network) { // nはstring
        this.sheet.getRange(7 + Number(i), 3).setValue(row['f'][1]['v']);
      }
    }
  }
}

Install.prototype.updateCvs = function() {
  var cvQuery = this.getCvQuery();
  var rows = this.bq.executeQuery(cvQuery);
  
  this.sheet.getRange(7, 4, 100).clear();
  this.sheet.getRange(7, 5, 100).clear();

  var cache_networks = this.sheet.getRange(7, 2, 100).getValues();
    
  for(k in rows) {
    row = rows[k];
    var bq_network = row['f'][0]['v']
    for (i in cache_networks) { // iはstring
      if(cache_networks[i][0] == bq_network) { 
        this.sheet.getRange(7 + Number(i), 4).setValue(row['f'][1]['v']);
        this.sheet.getRange(7 + Number(i), 5).setValue(row['f'][2]['v']);
      }
    }
  }
}

Install.prototype.getCvQuery = function() {
  return "WITH idfa_install_map AS ( " +
  " SELECT " + 
  " adId, " +
  " network_name " + 
  " FROM " + this.table + 
  " WHERE activity_kind = 'install' " +
  " ) " +
  " SELECT " + 
  " i.network_name AS install_network, " +
  " COUNT(DISTINCT(a.adId)), " +
  " COUNT(*) " +
  " FROM `" + this.table + "` AS a " +
  " LEFT OUTER JOIN idfa_install_map AS i " +
  " ON a.adId = i.adId" +
  " WHERE installed_at BETWEEN UNIX_SECONDS(TIMESTAMP('" + this.startTimeStr + "', 'Asia/Tokyo')) " + 
  " AND UNIX_SECONDS(TIMESTAMP('" + this.endTimeStr + "', 'Asia/Tokyo')) " +
  " AND a.event_name = 'entry_complete_form' " +
  " AND (a.created_at - a.installed_at) < (" + this.attr_window + " * 24 * 60 * 60) " +
  " AND environment = 'production' " +
  " AND _PARTITIONTIME BETWEEN TIMESTAMP('" + this.startTimeStr + "') " +
  " AND TIMESTAMP('" + this.endTimeStr + "') " +
  " GROUP BY install_network"
}