In the minimaps, we can see that...

## Respawn coordinates

Respawn areas are not evenly distributed, and they overlap heavily with kill zones, which is only natural.
This would lead to many players dying instantly after respawn if an earlier respawned player is present in the area, waiting for them.
We could implement an early death metric, death in less than 5 seconds of respawning, to see how frequent this happens and if it needs to be handled.
Alternatively, we could also make players invulnerable for the first 5 seconds after respawning.

## Human deadzones

There are many areas where botpositions are present, but human positions are sparse. This could be due to those areas being unattractive, or not engaging enough for humans, while bots don't have that problem.

We could divide all maps into small square areas, and define average occupancy of those areas. If the graph shows huge spikes in certain areas while very little count in others, we could try to understand why.

## BotKill >> BotKilled

Humans kill bots far more often than bots kill humans, which means bots need to get stronger if they are to simulate real humans.

A simple ratio of botkills to botkilled could be a good metric to understand this, with a target ratio of 1:1.
