# Exporting Study Data

## Exporting the Data

> [!CAUTION]
> This functionality is not currently functional! It needs to be updated to reflect the changes to support LLM-based agents and multiple users in the same session.

During the study, participants' behavioral data on the website is recorded in the MongoDB database that you have set up. MongoDB is a NoSQL Server in which data is stored in BSON (Binary JSON) documents and each document is built on a key-value pair structure. The details of this are not too important if you are not familiar with MongoDB.

Instead, a script (`data-export.js`) is provided in The Truman Platform project folder that when run, exports basic variables and information about the participants' behavioral metrics on Truman into a readable csv file. This eliminates the need for you to go into the database (which can be overwhelming) and allow you to easily analyze participants' behavioral data at the end of your study.

### How to export data into readable csv file

To run `data-export.js` to export participants' behavioral metrics data into a csv file:

1.  Ensure the value to the key **MONGODB_URI=** in the `.env` file is the MongoDB URL connection string to your database. If you followed the instructions to installing Truman, this should already be set to the correct value.
2.  Create a folder named `./outputFiles` in your base project directory. Exported csv files will go in this folder.
3.  Next, enter `node data-export.js` in your terminal/command prompt from your project directory. A new exported csv file is generated each time you enter this command and run the script.
4.  When the script is completed, you will find the csv file with the data in the folder `./outputFiles/truman-dataExport-.........csv`.
5.  To understand this file, see below.

### Data exported

In general, these are the types of behaviors calculated/ exported by the `data-export.js` file.

- All interactions with posts and comments (including likes, flags, view times)
- Participants' posting behavior
- Actor based interactions (Block, report, follow, profile view)
- Site log (time on site)
- Page log (pages visited)
- Participant information (MTurkID, username, experimental condition)

Below is a more detailed breakdown and description of each variable.

In the outputted csv file, each row is one participant and the value in a column corresponds to the variable column name.

| Variable Name           | Description                                                                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Id                      | Participant's provided Mechanical Turk ID                                                                                                                                                                                                                                                                                  |
| ResponseID              | (if applicable) Participant's provided Qualtrics ResponseID (see [Integrating Truman with Qualtrics](/docs/getting-started/launching-your-study.md#integrating-truman-with-qualtrics) for more details)                                                                                                                    |
| Username                | Participant's username                                                                                                                                                                                                                                                                                                     |
| Condition               | Participant's condition                                                                                                                                                                                                                                                                                                    |
| NumUserPostsCreated     | Number of posts _made_ by the participant                                                                                                                                                                                                                                                                                  |
| NumUserCommentsCreated  | Number of comments _made_ by the participant                                                                                                                                                                                                                                                                               |
| NumActorPostsLiked      | Number of actor posts _liked_ by the participant                                                                                                                                                                                                                                                                           |
| NumActorPostsFlagged    | Number of actor posts _flagged_ by the participant                                                                                                                                                                                                                                                                         |
| NumActorCommentsLiked   | Number of actor comments _liked_ by the participant                                                                                                                                                                                                                                                                        |
| NumActorCommentsFlagged | Number of actor comments _flagged_ by the participant                                                                                                                                                                                                                                                                      |
| UserPostsCreated        | Metadata of the participant-made posts, including:<br>- text of the post<br>- which day of the study the post was made (ex: 1, 2, 3, etc., where the day number is defined in 24-hour periods of the study)<br>Formatted like: _<TEXT>_, on Day _<DAY>_                                                                    |
| UserCommentsCreated     | Metadata of the participant-made comments, including:<br>- text of the comment<br>- id of the post the comment was left on<br>- which day of the study the comment was made (ex: 1, 2, 3, etc., where the day is defined in 24-hour periods of the study)<br>Formatted like: _<TEXT>_, on Post _<POST ID>_, on Day _<DAY>_ |
| ActorPostsLiked         | List of ids of the actor posts the participant liked                                                                                                                                                                                                                                                                       |
| ActorPostsFlagged       | List of ids of the actor posts the participant flagged                                                                                                                                                                                                                                                                     |
| ActorCommentsLiked      | List of ids of the actor comments the participant liked                                                                                                                                                                                                                                                                    |
| ActorCommentsFlagged    | List of ids of the actor comments the participant flagged                                                                                                                                                                                                                                                                  |
| ActorsBlocked           | List of actor usernames the participant blocked                                                                                                                                                                                                                                                                            |
| ActorsReported          | List of actor usernames the participant reported, and the reason for reporting<br>Formatted like: _<USERNAME>_, Reported for _<REASON>_                                                                                                                                                                                    |
| ActorsFollowed          | List of actor usernames the participant followed                                                                                                                                                                                                                                                                           |
| TimeOnSite              | Total amount of time (in seconds) participant spent on site                                                                                                                                                                                                                                                                |
| PageLog                 | List of page URLs the participant visited                                                                                                                                                                                                                                                                                  |

## Analyzing the Data and Paying Participants

You can use programs like R or other analyzing tools to analyze the data, find interesting trends and statistical significance, and compare different conditions.

The key that unites the participants' data with any Qualtrics pre-study surveys or Qualtrics post-study surveys results that you have used in your study is the ResponseID (see [Integrating Truman with Qualtrics](/docs/getting-started/launching-your-study.md#integrating-truman-with-qualtrics)
for more details)

You may also use the Mechanical Turk ID value of participants and the exported data to identify and help with payments/ rewards after the study.

| [Previous<br>Launching Your Study](/docs/getting-started/launching-your-study.md) | [Next<br>Citation and Papers](/docs/getting-started/citation-and-papers.md) |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
