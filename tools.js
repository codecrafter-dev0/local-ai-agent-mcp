const tools = [
  {
    type: "function",
    function: {
      name: "turn_on_light",
      description: "Turn on the room light when the user asks to turn on or activate the light.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "turn_off_light",
      description: "Turn off the room light when the user asks to turn off or deactivate the light.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "turn_on_fan",
      description: "Turn on the room fan when the user asks to turn on or activate the fan.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "study_mode_on",
      description: "Enable study mode, typically turning on bright room lighting for studying.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sleeping_mode_on",
      description: "Enable sleeping mode, typically turning off or dimming lights for sleep.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_fan_speed",
      description: "Set the speed of a fan in a specific room (e.g., off, low, medium, high, or a numeric level).",
      parameters: {
        type: "object",
        properties: {
          room: {
            type: "string",
            enum: ["bedroom", "study_room", "living_room"],
            description: "Target room where the fan is located."
          },
          speed: {
            type: "integer",
            minimum: 0,
            maximum: 5,
            description: "Fan speed level from 0 (off) to 5 (maximum speed)."
          }
        },
        required: ["room", "speed"]
      }
    }
  }
];

module.exports = tools;
