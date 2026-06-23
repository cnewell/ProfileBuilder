# 3. Represent preferences using preferred and forbidden lists

Date: 2026-06-23

## Status

Accepted

## Context

We want to represent preferences in a structured way, and be able to detect conflicts

## Decision

Represent them as a list of legal values, and then a subset of those values that are preferred, and a subset that
are forbidden, which should remain disjoint.

## Consequences

This gives us a clear schema for our preferences that lets us reason on them later, but limits
the preferences we can capture to those we specify up front.

