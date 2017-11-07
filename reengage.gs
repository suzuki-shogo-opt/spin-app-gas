Reengage = function() {
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

function initReengage() {
  return new Reengage();
}

// debug用
function testReengage() {
  return new Reengage().update();
}

Reengage.prototype.update = function() {
  this.copyNetworkCache();
  this.updateReengages();
  this.updateReengageCvs();
  this.sheet.getRange(6, 7, 100, 5).setBorder(true, true, true, true, true, true)
}

Reengage.prototype.copyNetworkCache = function() {
  this.sheet.getRange(7, 2, 100).copyTo(this.sheet.getRange(7, 7));
}

Reengage.prototype.updateReengages = function() {
  var reengageQuery = this.getReengageQuery();
  var rows = this.bq.executeQuery(reengageQuery);
  
  this.sheet.getRange(7, 8, 100).clear();
  this.sheet.getRange(7, 9, 100).clear();
  
  var cache_networks = this.sheet.getRange(7, 2, 100).getValues();
  
  for(k in rows) {
    row = rows[k];
    var bq_network = row['f'][0]['v']
    for (i in cache_networks) { // iはstring
      if(cache_networks[i][0] == bq_network) { 
        this.sheet.getRange(7 + Number(i), 8).setValue(row['f'][1]['v']);
        this.sheet.getRange(7 + Number(i), 9).setValue(row['f'][2]['v']);
      }
    }
  }
}

Reengage.prototype.getReengageQuery = function() {
  return "SELECT" +
  " DISTINCT(network_name), " +
  " COUNT(DISTINCT(" + this.adId + ")), " +
  " COUNT(*) " +
  " FROM " +  this.table +
  " WHERE activity_kind = 'reattribution'" +
  " AND " + this.ptCond +
  " GROUP BY network_name "
}

Reengage.prototype.updateReengageCvs = function() {
  var reengageCvQuery = this.getReengageCvQuery();
  var rows = this.bq.executeQuery(reengageCvQuery);
  
  this.sheet.getRange(7, 10, 100).clear();
  this.sheet.getRange(7, 11, 100).clear();
  
  var cache_networks = this.sheet.getRange(7, 2, 100).getValues();
  
  var newRows = {};
  
  for(k in rows) {
    var row = rows[k];
    var network = row['f'][0]['v'];
    var uu = Number(row['f'][1]['v']);
    var total = Number(row['f'][1]['v']);
    
    if (newRows[network]) {
      newRows[network] = [uu + newRows[network][0], total + newRows[network][1]]
    } else {
      newRows[network] = [uu, total]
    }
  }
  
  
  for(network in newRows) {
    var uu = newRows[network][0];
    var total = newRows[network][1];
    for (i in cache_networks) { // iはstring
      if(cache_networks[i][0] == network) { 
        this.sheet.getRange(7 + Number(i), 10).setValue(uu);
        this.sheet.getRange(7 + Number(i), 11).setValue(total);
      }
    }
  }
}

Reengage.prototype.getReengageCvQuery = function() {
  return " WITH idfa_install_map AS ( " +
  " SELECT " +
  " idfa, " +
  " network_name " +
  " FROM " + this.table +
  " WHERE activity_kind = 'install' " +
  " ), " +
  " cv_users AS ( " +
  " SELECT " +
  "  a.idfa, " +
  "  i.network_name AS install_network, " +
  "  a.network_name AS reat_network, " +
  "  a.created_at, " +
  "  a.installed_at " +
  "  FROM `" + this.table + "` AS a " +
  "  LEFT OUTER JOIN idfa_install_map AS i " +
  "  ON a.idfa = i.idfa " +
  "  WHERE reattributed_at BETWEEN UNIX_SECONDS(TIMESTAMP('" + this.startTimeStr + "', 'Asia/Tokyo')) " + 
  "  AND UNIX_SECONDS(TIMESTAMP('" + this.endTimeStr + "', 'Asia/Tokyo')) " +
  "  AND event_name = 'entry_complete_form' " +
  "  AND (created_at - reattributed_at) < (24 * 60 * 60) " + 
  "  AND _PARTITIONTIME BETWEEN TIMESTAMP('" + this.startTimeStr + "') " +
  "  AND TIMESTAMP('" + this.endTimeStr + "') " +
  " ) " +
  " SELECT " +
  " reat_network, " +
  " COUNT(DISTINCT(idfa)), " +
  " COUNT(*) " +
  " FROM cv_users " +
  " WHERE install_network != 'Organic' " +
  " AND (created_at - installed_at) > (" + this.attr_window + " * 24 * 60 * 60) " +
  " GROUP BY reat_network " +
  " UNION ALL " +
  " SELECT " +
  " reat_network, " +
  " COUNT(DISTINCT(idfa)), " +
  " COUNT(*) " +
  " FROM cv_users " +
  " WHERE install_network = 'Organic' " +
  " GROUP BY reat_network "
}


