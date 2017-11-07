BqApi = function() {
}

// Dashboardクラスが参照できなかったためinit関数を定義
function initBqApi() {
  return new BqApi();
}

BqApi.prototype.executeQuery = function executeQuery(query) {
  const PROJECT_ID = 'spinappadjust';
  const SLEEP_TIME_MS = 500;
      
  var queryResults = BigQuery.Jobs.query({query: query, useLegacySql: false}, PROJECT_ID);
  while (!queryResults.jobComplete) {
    Utilities.sleep(SLEEP_TIME_MS);
    sleepTimeMs *= 2;
    queryResults = BigQuery.Jobs.getQueryResults(
      projectId,
      queryResults.jobReference.jobId
    );
  }
  return queryResults.rows;
}

