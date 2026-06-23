## Prompting Highlights

```
❯ Modify this next.js app to have a UX with a text field that the user can
  enter a prompt into, and a submit button that when pressed sends the
  contents of that text field to Anthropic Claude. Use the standard API
  endpoint for Anthropic, and the key defined in the enviornment variable
  ANTHROPIC_API_KEY. The LLM should identify any travel preferences in the text
  of the prompt. Stream two different responses from the LLM: one normal text
  response, and one JSON list of strings, one per preference, using server-sent
  events for both. In the client, route the text response to one text field,
  and a pretty-print of the JSON to a second text field.
```
This was the first push to get a hello-world in place, focused on having the LLM
doing (unstructured) preference detection to verify that it would view the same
sorts of things as preferences that I would and tune the instructions. It
deliberately does not keep conversation state yet. There were a number of things
that I had it fix pretty quickly: it was using a version of the Claude Sonnet model
that was incorrect, the UI was unreadable, and it was pulling up the text response
and JSON responses sequentially (although I did not get this working as well as
I wanted, but was losing too much time to debugging).

```
❯ In route.js, instead of creating a user message with the prompt baked into    
  it, create system messages that include the general directions for the        
  response to create, and just pass the prompt as the content of the user       
  message.
```
Claude code had been embedding the instructions in each user message as boilerplate
surrounding the actual user prompt, and I broke those out instead into system messages.
When I got the the stage of shipping the entire conversation, this meant that the
instructions only had to go in once and the user messages in the conversation could
just focus on user text.

```
❯ For the JSON output, when calling client.message.create, pass it an           
  output_config parameters with the following object:                           
  {                                                                             
    "format": "json_schema",                                                    
    "schema": { [...]
```
This is the section where I started setting up the output_config parameter. This kept
failing with an error about input not matching the expected shape. I lost time debugging
here, too, and eventually fell back on asking Claude Code (which did not give a suggestion
that proved useful) so I backed it out for now.

```
❯ Change the system prompt for the JSON response to include the following JSON  
  object:                                                                       
                                                                                
  {
```
This is the point where I set up the structure and supported values for my preferences:
each one had a name, a list of legal values, and (initially empty) lists of
preferred and forbidden values. For the purposes of this exercise, I set it up to capture
"Month of Travel", "Region", and approximate "Duration" for given travel, but this could
expand easily to encompass many more preferences. I was able to verify that it was able
to return values consistent with the text I was providing, and was able to infer Region
from specific destinations (e.g. New Zealand and Maui both successfully matched "Australia
and Pacific Islands", and New Year's Eve successfully matched December for month of travel.

```
❯ in the client, define a Message type that has two properties, role (string)
  and content (string), and define a list of messages that remains in client
  state across submits. Right before submitting a new prompt to the API, save
  create a Message with the role "user" and content set to the text of the
  prompt, and append that Message to the list of messages. When a test response
  has finished streaming, create a Message with the role set to "assistant"
  and the content set to the full text of the text response, and append that to
  the end of the list of Messages.
```
This was the start of working with the full conversation rather than just individual
prompts. I then modified the UX to display the full conversation in the text field instead
of just the most recent prompt.

```
❯ Create a const in the Client corresponding to the JSON preferences object
  that's defined in route.ts in the system prompt for the JSON stream.
  When the JSON content finishes loading, build the JSON object represented and
  save it to local storage.

  When the user submits a prompt, attempt to get the JSON preferences object
  from local storage. If it is not availavble, use the default as defined in
  the const specified above.

  Refactor the API between the client and route.ts such that instead of just
  passing the text of the prompt, it passes a JSON object with two fields: the
  list of messages that it has collected so far, and the value you've found for
  the preferences object (either as persisted in local storage, or using the
  constant default)
```
In this step, I began keeping the preferences as state in the client, using
local storage to persist it. In the long run, this is an area where I would
very likely look at other storage options, especially when moving to multi-user.

```
❯ Refactor route.js so that instead of just looking at the most recent message  
  in the list of message entered, pass all of the messages on the list to the   
  LLM.                                                                          
```
And this was the final step of this refactor, updating the API to pass the conversation
to the LLM rather than just the most recent prompt.

```
❯ Alter the system prompt for the text response: inteaad of returning a textual 
  form of the preferences identified, create a chat response. You are a         
  helpful travel advisor who is having a conversation with the user with the    
  intent of helping them clarify and expand on their preferences. Let yourself  
  be guided by the values on the preferences object - e.g. which preferred and  
  forbidden values have been populated, and which havent - to steer the         
  conversation.                                                                 
```
So far, I've still had the text response also focused on extracting preferences.
Here, I tune it toward an interview style to get the user to dig further into
their preferences.

```
❯ When the JSON response has completed in the client, before saving an updated  
  version of the JSON object to local storage, check the resulting preferences  
  object for any cases where a preference has the same value showing up in both 
  the preferred and forbidden list. [...]
```
And here is where I did the conflict detection and repair. At this point, I was
running short on time, so I was doing quick scans of the results, especially the
created modal UX, rather than going through them line by line.

One unexpected issue at this stage was the LLM "helpfully" trying to disambiguate
the preferred and forbidden lists in cases where the context suggested one value
belonged in both, which meant I had to be clear in the instructions I was giving
that it should still include both (and let the client have the user disambiguate
them).

## Reflection

I spent some time up front thinking about representations for preferences, as well
as planning out key features. I wanted to focus on getting an the application to
eventually hold a conversation with the user in order to flesh out their preferences,
while getting that into a structured form that would lend itself to both conflict
detection and resolution (in the current version) and filtered searches of travel
packages potentially using more traditional search (in future versions.

My approach was to iteratively approach a working version, starting with getting
a platform up quickly that would let me experiment with how the LLM was responding
to embedded preferences before tightening up the structured results, supporting
conversations with state managed in the client, and detecting conflicts. As pulling
in destination data from an external API wasn't required for any of that, but built
on it, and knowing that I had two hours to work with, I chose to deprioritize that
and address it at the end if time remained.

For the first steps, I reviewed it line-by-line. I made a few small changes directly
via the editor, but primarily by prompting Claude Code to refactor.

I ended up killing more time than I expected up front with project boilerplate: github,
next.js create-next-app@latest, and standing up ADRs. For the long term, I'd be using
a github template or a setup script for a lot of that. In retrospect, things like the
ADRs also ate up time at the start of my two hours (even in their cursory form) where
I probably would keep notes on paper and fill them in after the two-hour sprint rush
next time. I also need to dig into Claude's structured output support in more detail,
as that's not something I've done enough with yet.

For scaling, I would be evalutating other models. I went with Anthropic because of its
advertised support for structured output and because I had the most experience with it
when looking at a two hour window. I was using Sonnet, which is their mid-range model
below Opus but above Haiku, but it would be easy to swap in the latter to evaluate it
as a less expensive option.
