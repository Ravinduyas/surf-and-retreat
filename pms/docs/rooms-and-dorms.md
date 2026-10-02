# Rooms and dorms — building real inventory

**Status:** requirements. Nothing here is built yet.

The ask: replace the demo rooms and beds with inventory the property defines
itself, and make the room/dorm builder good enough for a real hostel-and-hotel
business rather than a demo.

---

## What is actually there today

Being accurate about this matters, because the gap is not where it looks.

**There is already a room type editor and a room builder.** Configuration →
Room types creates and edits types; Configuration → Rooms adds rooms singly or
in bulk across floors, and generates beds for dorm rooms. None of that needs
rebuilding.

**What is thin is the model underneath.** A room type today is: code, name,
description, kind (`room`/`dorm`), base and max occupancy, max adults, max
children, three prices, a JSON amenities list, a gender policy, and a sort
order. A room is: number, floor, wing, status, housekeeping section, a JSON
features list, notes, and a connecting-room pointer. A bed is: code, and
`top`/`bottom`/`single`.

That is enough to sell a night. It is not enough to answer the questions a
property is asked every day.

---

## The three real gaps

### 1. There is no bed configuration — this is the serious one

Nothing in the system can express *"a Family Room contains one king and two
singles"*. The `beds` table exists only for dorms, and only records whether a
bunk is top or bottom.

Everything downstream suffers for it:

- **"Will five people fit?"** cannot be answered. `max_occupancy = 5` says five
  bodies are permitted; it does not say whether they have anywhere to sleep.
- **The guest cannot be told what they are booking.** "Sleeps 4" is not the same
  offer as "1 double + 2 singles", and the second is what decides the booking.
- **OTAs require it.** Booking.com and Airbnb both ask for bed layout per room
  type. Without it the listing is incomplete and ranks worse.
- **Housekeeping cannot plan linen.** A king, two twins and a sofa bed are three
  different linen sets.
- **The "family room with 2 double beds" the demo already contains** is
  expressed nowhere except in its name.

### 2. Upgrade ranking is guessing from price

`overbookingfix.ts` decides whether a room is an upgrade by comparing
`default_rate_minor`. I wrote that, and the comment there admits what it is:

> `default_rate_minor` is the honest proxy for "better" … Anything else — a name
> containing "Deluxe" — is a guess about somebody else's inventory.

It is a reasonable proxy and it is still a proxy. Two types priced the same are
unrankable; a type discounted for a season silently stops being an upgrade. A
property knows its own hierarchy — it should be able to state it.

### 3. Dorm beds are generated mechanically, not designed

`bedCount` beds are created and alternately labelled bottom/top. There is no
notion of a pod, a capsule, a double bunk, a bed with a curtain, a locker, or a
power socket — which is most of what a hostel guest actually chooses between.
Gender policy exists on the type but has no *dynamic* option, which is how most
mixed dorms are really sold.

---

## Requirements

### I1 · Bed configuration on the room type

**Done when**

1. A room type carries a list of beds: kind and count — e.g. `1 × king`,
   `2 × single`, `1 × sofa bed`.
2. Bed kinds are a defined vocabulary with sleeping capacity attached: single 1,
   double 2, queen 2, king 2, bunk 2, sofa bed 1–2, futon 1, cot/crib 1.
3. **Sleeping capacity is derived from the beds, and the form says so.** If the
   configuration sleeps 4 and `max_occupancy` is 6, the screen states the
   discrepancy rather than silently allowing a booking with nowhere to sleep.
4. A room may override its type's configuration — real properties have one room
   with a different bed, and pretending otherwise forces a second room type.
5. The guest-facing summary reads naturally: "1 king, 2 singles · sleeps 4".

### I2 · The attributes a property is actually asked for

**Done when**

1. **Size** in m² or ft², with the property's unit preference remembered.
2. **View** — sea, garden, city, courtyard, pool, mountain, none.
3. **Bathroom** — ensuite, private-but-outside, shared. Non-negotiable for
   hostels, and the single most common guest complaint when it is wrong.
4. **Smoking** — permitted or not.
5. **Accessibility** — step-free access, wet room, grab rails, hearing loop, as
   discrete flags rather than a free-text amenity nobody can filter.
6. **Floor range** the type occupies, and whether a lift serves it.
7. **Photos**, ordered, with the first as the hero image.
8. Amenities move from a free-text JSON array to a **checklist with a defined
   vocabulary**, so they can be mapped to a channel and filtered on. Free text
   stays available for the genuinely unusual.

### I3 · A stated hierarchy, not an inferred one

**Done when**

1. A room type carries an explicit **rank**, set by dragging the list into
   order. Rank 1 is the property's best room.
2. `overbookingfix.ts` uses rank, falling back to price only where rank is unset
   — so an existing property keeps working and improves the moment it is set.
3. The upgrade list is ordered by "one step up" rather than "cheapest jump",
   which is what a duty manager actually offers.
4. Rank is separate from `sort_order`: what a property lists first on its
   website is not always its best room.

### I4 · Dorms, properly

**Done when**

1. **Bed kinds for dorms**: standard bunk, single bunk (no bed above), pod,
   capsule, double bunk (two people per berth). Each with capacity.
2. **Per-bed attributes**: curtain, reading light, power socket, locker, USB.
   These are what a hostel guest chooses between and what the OTA listing shows.
3. **Per-bed pricing.** A bottom bunk and a pod are not worth the same. A bed
   may carry a price adjustment against its dorm's rate.
4. **Gender policy** gains a *dynamic* option: the dorm takes the gender of its
   first booker and closes to the other, reverting when it empties. This is how
   most mixed hostels really operate and it cannot be expressed today.
5. **Bathroom and locker** stated at dorm level.
6. Bed codes follow a pattern the property chooses (`101-A`, `101-01`, `D1-T3`),
   not a fixed one.
7. The bed builder previews the room before it is created — a 12-bed dorm built
   wrongly is 12 rows to delete.

### I5 · Occupancy that answers the real question

**Done when**

1. Adults, children and **infants** counted separately, with an age definition
   per property. An infant in a cot is not an occupant for capacity purposes.
2. Booking is refused, with a plain reason, when the party cannot physically
   sleep in the configuration — not merely when it exceeds a number.
3. Extra-bed and cot availability per room type, with their own charges and a
   limit.
4. The quote explains what the party will sleep in.

### I6 · The builder

**Done when**

1. Creating a room type is a short guided flow, not one long form: what kind →
   beds → capacity → attributes → price.
2. **Templates** for the common shapes — Single, Twin, Double, Family, 4/6/8-bed
   dorm — that fill sensible defaults and are then edited. A property should not
   describe a twin room from nothing.
3. The bulk room builder previews exactly what it will create, with the room
   numbers listed, before it writes anything.
4. Duplicating a room type takes one action.
5. Deactivating a type that has future bookings explains what will happen rather
   than refusing or silently orphaning them.

### I7 · Categories the channels understand

**Done when**

1. Each room type maps to a channel room category, per channel.
2. Bed configuration and occupancy are included in what is pushed.
3. Unmapped types are visible as unmapped, rather than silently not selling.

### I8 · Getting the demo data out

**Done when**

1. A property can clear demo inventory in one action, with a plain statement of
   what will be deleted and a refusal if any of it has bookings against it.
2. The first-run wizard builds real inventory from templates instead of seeding
   The Fun Bunk's rooms.
3. Existing installations are unaffected: every new column is added by
   `ensureColumn`, every new table by `CREATE TABLE IF NOT EXISTS`, and nothing
   already sold changes meaning.

---

## Build order

| # | Item | Why here |
|---|---|---|
| 1 | **I1 Bed configuration** | Everything else leans on it; it is also the one thing that cannot be expressed at all today |
| 2 | **I5 Occupancy rules** | Meaningless before I1, immediate once it exists |
| 3 | **I4 Dorms** | The property's own inventory is mostly dorms; highest daily value |
| 4 | **I2 Attributes** | Wide but shallow — mostly columns and a form |
| 5 | **I3 Ranking** | Small, and removes a known hack from the upgrade path |
| 6 | **I6 Builder** | Best done once the fields it must collect are settled |
| 7 | **I8 Demo data out** | Last, so the property builds on the finished model |
| 8 | **I7 Channel mapping** | 🔌 Needs a live Beds24 account to verify against |

---

## What this deliberately does not do

- **No AI-generated room descriptions.** A property's own words about its rooms
  are worth more than plausible-sounding filler, and a wrong description is a
  complaint at check-in.
- **No automatic pricing suggestions from bed configuration.** What a room is
  worth is the property's judgement; the system's job is to hold the answer, not
  to invent one.
- **No dynamic gender rebalancing beyond the dorm's own policy.** Moving guests
  between dorms to optimise occupancy is a decision about people.
