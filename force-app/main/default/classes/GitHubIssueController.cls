public with sharing class GitHubIssueController {
    
    @AuraEnabled
    public static void syncIssues(String repoOwner, String repoName){
        Http http = new http();
        HttpRequest request = new HttpRequest();

        //request.setEndpoint('callout:GitHub_API/repos/' + repoOwner + '/' + repoName + '/issues');
        request.setEndpoint('callout:GitHub_API/repos/' + repoOwner + '/' + repoName + '/issues?state=all&per_page=10');
        request.setMethod('GET');
        request.setHeader('Accept', 'application/vnd.github+json');
        request.setHeader('User-Agent', 'Salesforce-Dev-Org');
        request.setHeader('X-GitHub-Api-Version', '2026-03-10');

        HttpResponse response = http.send(request);

        if (response.getStatusCode() == 200) {
            List<Object> results = (List<Object>) JSON.deserializeUntyped(response.getBody());
            List<GitHub_Issue__c> issuesToUpsert = new List<GitHub_Issue__c>();

            for (Object obj : results) {
                Map<String, Object> issueMap = (Map<String, Object>) obj;

                if (issueMap.containsKey('pull_request')) continue;

                GitHub_Issue__c issue = new GitHub_Issue__c(
                    Name = String.valueOf(issueMap.get('number')),
                    Title__c = (String) issueMap.get('title'),
                    State__c = (String) issueMap.get('state'),
                    HTML_URL__c = (String) issueMap.get('html_url'),
                    Repository__c = repoOwner + '/' + repoName,
                    External_Id__c = repoOwner + '/' + repoName + '-' + String.valueOf(issueMap.get('number'))
                );
                issuesToUpsert.add(issue);
            }

            if (!issuesToUpsert.isEmpty()) {
                upsert issuesToUpsert GitHub_Issue__c.External_Id__c;
            }

            Issue_Sync_Event__e syncEvent = new Issue_Sync_Event__e(
                Repository__c = repoOwner + '/' + repoName,
                Status_Message__c = 'Successfully synced ' + issuesToUpsert.size() + ' issues.'
            );

            EventBus.publish(syncEvent);
        } else {
            throw new CalloutException('Failed to fetch GitHub issues. Status: ' + response.getStatus());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<GitHub_Issue__c> getLocalIssues(String repoName){
        return [
            SELECT Id, Name, Title__c, State__c, HTML_URL__c, Repository__c, LastModifiedDate
            FROM GitHub_Issue__c
            WHERE Repository__c = :repoName
            ORDER BY Name DESC
            LIMIT 20
        ];
    }
}