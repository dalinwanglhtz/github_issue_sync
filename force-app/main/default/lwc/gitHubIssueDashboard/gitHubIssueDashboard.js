import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';
import syncIssues from '@salesforce/apex/GitHubIssueController.syncIssues';
import getLocalIssues from '@salesforce/apex/GitHubIssueController.getLocalIssues';

const columns = [
    { label: 'Issue #', fieldName: 'Name', type: 'text', initialWidth: 90 },
    { label: 'Title', fieldName: 'Title__c', type: 'text' },
    { label: 'State', fieldName: 'State__c', type: 'text', initialWidth: 100},
    { 
        label: 'URL',
        fieldName: 'HTML_URL__c',
        type: 'url',
        typeAttributes: { label: { fieldName: 'HTML_URL__c' }, target: '_blank' } 
    }
];

export default class GitHubIssueDashboard extends LightningElement {
    @track repoOwner = 'dalinwanglhtz';
    @track repoName = 'salesforce-audit-trail';
    isSyncing = false;
    columns = columns;

    subscription = {};
    channelName = '/event/Issue_Sync_Event__e';

    get fullRepoName() {
        return `${this.repoOwner}/${this.repoName}`;
    }

    @wire(getLocalIssues, { repoName: '$fullRepoName' })
    issues;

    connectedCallback() {
        this.handleSubscribe();
        this.registerErrorListener();
    }

    disconnectedCallback() {
        this.handleUnsubscribe();
    }

    handleOwnerChange(event) {
        this.repoOwner = event.target.value;
    }

    handleRepoChange(event) {
        this.repoName = event.target.value;
    }

    handleSync() {
        this.isSyncing = true;
        syncIssues({ repoOwner: this.repoOwner, repoName: this.repoName })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Sync request initiated successfully',
                        variant: 'success',
                    })
                );
                this.isSyncing = false;
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error Syncing Issues',
                        message: error.body.message,
                        variant: 'error',
                    })
                );
                this.isSyncing = false;
            });
    }

    handleSubscribe() {
        const messageCallback = (response) => {
            const eventPayload = response.data.payload;

            if (eventPayload.Repository__c === this.fullRepoName) {
                this.dispatchEvent({
                    title: 'Real-Time Update',
                    message: eventPayload.Status_Message__c,
                    variant: 'info'
                });
                refreshApex(this.issues);
                this.isSyncing = false;
            }
        };

        subscribe(this.channelName, -1, messageCallback)
            .then(response => {
                this.subscription = response;
            });
    }

    handleUnsubscribe() {
        unsubscribe(this.subscription, response => {});
    }

    registerErrorListener() {
        onError(error => {
            console.error('empApi error: ', JSON.stringify(error));
        });
    }
}