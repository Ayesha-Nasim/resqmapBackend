const express = require('express');
const router = express.Router();

// Mock boundary data - replace with real database/GeoJSON
const mockBoundaries = [
  {
    id: 'city_boundary',
    name: 'City Boundary',
    type: 'polygon',
    coordinates: [
      [30.35, 69.32],
      [30.35, 69.37],
      [30.40, 69.37],
      [30.40, 69.32],
      [30.35, 69.32],
    ],
    properties: {
      area: 'Main City',
      population: 1500000,
      emergency_zones: ['Zone A', 'Zone B'],
    },
  },
  {
    id: 'emergency_zone_a',
    name: 'Emergency Zone A',
    type: 'polygon',
    coordinates: [
      [30.36, 69.33],
      [30.36, 69.35],
      [30.38, 69.35],
      [30.38, 69.33],
      [30.36, 69.33],
    ],
    properties: {
      type: 'High Risk',
      response_team: 'Team Alpha',
    },
  },
];

router.get('/', (req, res) => {
  try {
    res.json({
      success: true,
      boundaries: mockBoundaries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch boundaries',
    });
  }
});

module.exports = router;