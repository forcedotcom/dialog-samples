# Sample Dialogs

Custom dialogs to replace native alert and confirm.

## Installation Instructions

### Prerequisites
* [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli)
* [Enable Dev Hub in your org](https://help.salesforce.com/s/articleView?id=sf.sfdx_setup_enable_devhub.htm&type=5)

### Steps
1. Clone this repository:

    ```
    git clone https://github.com/forcedotcom/dialog-samples
    cd dialog-samples
    ```

2. Authorize with your Dev Hub org and provide it with an alias (**mydevorg** in the command below):

    ```
    sfdx auth:web:login -d -a mydevorg
    ```

2. Create a scratch org and provide it with an alias (**dialog-samples** in the command below):

    ```
    sfdx force:org:create -s -f config/project-scratch-def.json -a dialog-samples
    ```

3. Push the app to your scratch org:

    ```
    sfdx force:source:push
    ```

4. If your org isn't already open, open it now:

    ```
    sfdx force:org:open
    ```

5. In **Setup**, verify the **dialog_samples** static resource and the **editAccountName** Visualforce page exist.

6. Go to an account and select Edit Page. Add the **editAccountName** page to the page layout and save.

7. Go back to the account and you should see the Visualforce page embedded in the page layout:

![Visualforce in Account page layout](vf-in-acct-layout.png)

8. Modify the account name and hit Save.  A confirm dialog should display.

9. Modify the account name such that it contains special characters like !@#$%^&*() and hit Save. An alert dialog should display to indicate an error.
