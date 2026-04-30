# Frequently Asked Questions

<details>
<summary>I uploaded my new simulation pictures into the project file directory **`/scenarios/<scenario name>`** and the file names in my csv files exactly match the file names of my pictures, but I still don't see the new pictures loaded in my simulation. What should I do?</summary>

Check that you have defined the CDN URL value properly.

Navigate to the `.env` file:

1.  If you are not using a CDN, remove the line `CDN=https://d35ayucabfexcy.cloudfront.net`.
2.  If you are using a CDN, replace the URL with your CDN URL.
3.  If you do not know if you are using a CDN or not, you are likely not using one, so remove the line of code.

Save the file, then restart your local environment. In the Terminal/Command prompt:

1.  If the application is already running, enter CTRL+C, then Y to stop the application.
2.  Start your application again by entering `npm run dev` .

</details>

<details>
<summary>I updated the simulation content by changing the csv files in the project file directory **`/scenarios/<scenario name>`**, but I don't see the new content in my simulation. What should I do?</summary>

Make sure you have repopulated the database with the new simulation content by entering the command in the terminal/command prompt: `node populate.js`, which runs the script populate.js.

Note: Every time you make any changes to the csv files, you will need to repopulate your databases with the csv content (whether that is the database you are using for your local Truman or your deployed Truman). This is because the simulation gets the simulation content from the database, and not the csv files.

</details>

<details>
<summary>How do I use emojis in the simulation content?</summary>

To see emojis in your csv files and to use emojis in your simulation content, you will need to ensure your csv files are opened and saved as a CSV UTF-8 (Comma delimited) (\*.csv) file format.

More information about this is found under the note _"How to edit the csv files..."_ on the page [How to define the simulation components](/docs/setting-up-truman/defining-your-simulation/simulation-components.md#how-to-define-the-simulation-components).

</details>

<details>
<summary>A participant emailed me saying they have forgotten their account password. What should I do?</summary>

All passwords are hashed when saved in the database. They are never saved "as is", to ensure the privacy and security of all Truman users. Therefore, no one knows their password, even the researcher.

So, the only way to assist them is to reset their account with a new temporary password and to send them the new temporary password.

To do this, you will need to run the script **updatePassword.js,** which connects to the database defined in the **.env** file, finds the right user, and updates their password.

To run this script, enter in the terminal/command prompt from the root directory of your project: `node updatePassword.js <email> <password>` . Replace &lt;email&gt; and &lt;password&gt; with the email associated with the desired account and the new password (for example: `node updatePassword.js johndoe@gmail.com 12345`).

Ensure that that you run this command on your server if the account you are changing the password to is for your _deployed_ application (so that it finds and changes the account in the right database).

Afterwards, you will need to send the participant their new temporary password. Please remind them that they will need to change the password again for their own security and privacy by going to the **Update My Profile** page on the website.

</details>

<details>
<summary>How do I display different simulations for different experimental conditions?</summary>

You can readily display different _**simulation content**_ (example: actors, posts, comments) for different experimental conditions by using the **`.env`** file and the input csv files.

In the `.env` file,

1.  Define the environmental variable `NUM_EXP_CONDITIONS` with the # of experimental conditions you have. For example:
    NUM_EXP_CONDITIONS=5
2.  Define the environmental variable `EXP_CONDITIONS_NAMES` with the names of your experimental conditions. Each name should be separated with a comma, with no spaces in between. For example:
    EXP_CONDITIONS_NAMES=marginal,unambig_flag,troll,ambig_flag,unambig_none

See [here](/docs/setting-up-truman/defining-your-simulation/basic-simulation-components.md) for more information about the environmental variables and how to change them.

Then, in the input csv files, use the column **condition** to label which condition certain simulation content should be displayed in. The labels in this column must exactly match one of the experimental conditions names listed in `EXP_CONDITIONS_NAMES` in the `.env` file.

However, displaying different _**interfaces**_ for different experimental conditions will require coding experience. You will need to make changes in the codebase to develop the different interfaces and logic for display.

</details>

<details>
<summary>How do I bring in new updates that have been made to the original Truman GitHub repository into my own GitHub repository?</summary>

On occasion, we push new code updates or bug fixes to the [Truman Agents GitHub repository](https://github.com/Cornell-Design-AI-Group/TrumanAgents). This may happen after you have forked your own GitHub repository from this repository, in which case you would like to bring in these new code changes into your repository.

To do this, follow the instructions here: [https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)

It is possible that as you do this, you will need to resolve merge conflicts (i.e. differences in code) manually.

</details>

| [Previous<br>Best Practices for Simulation Building](/docs/setting-up-truman/defining-your-simulation/best-practices-for-simulation-building.md) | [Next<br>File Directory](/docs/setting-up-truman/file-directory.md) |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
