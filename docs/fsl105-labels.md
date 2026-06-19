# FSL-105 Label Inventory

Source: `datasets/raw/fsl_105/labels.csv` (DOI: 10.17632/48y2y99mb9.2)

- **Total labels**: 105
- **Total video clips**: 2130
- **Video duration**: 4 seconds each
- **Categories**: 12

## Labels by Category

### GREETING (10 signs)
| ID | Label |
|----|-------|
| 0 | GOOD MORNING |
| 1 | GOOD AFTERNOON |
| 2 | GOOD EVENING |
| 3 | HELLO |
| 4 | HOW ARE YOU |
| 5 | IM FINE |
| 6 | NICE TO MEET YOU |
| 7 | THANK YOU |
| 8 | YOURE WELCOME |
| 9 | SEE YOU TOMORROW |

### SURVIVAL (10 signs)
| ID | Label |
|----|-------|
| 10 | UNDERSTAND |
| 11 | DON'T UNDERSTAND |
| 12 | KNOW |
| 13 | DON'T KNOW |
| 14 | NO |
| 15 | YES |
| 16 | WRONG |
| 17 | CORRECT |
| 18 | SLOW |
| 19 | FAST |

### NUMBER (10 signs)
| ID | Label |
|----|-------|
| 20 | ONE |
| 21 | TWO |
| 22 | THREE |
| 23 | FOUR |
| 24 | FIVE |
| 25 | SIX |
| 26 | SEVEN |
| 27 | EIGHT |
| 28 | NINE |
| 29 | TEN |

### CALENDAR (12 signs)
| ID | Label |
|----|-------|
| 30 | JANUARY |
| 31 | FEBRUARY |
| 32 | MARCH |
| 33 | APRIL |
| 34 | MAY |
| 35 | JUNE |
| 36 | JULY |
| 37 | AUGUST |
| 38 | SEPTEMBER |
| 39 | OCTOBER |
| 40 | NOVEMBER |
| 41 | DECEMBER |

### DAYS (10 signs)
| ID | Label |
|----|-------|
| 42 | MONDAY |
| 43 | TUESDAY |
| 44 | WEDNESDAY |
| 45 | THURSDAY |
| 46 | FRIDAY |
| 47 | SATURDAY |
| 48 | SUNDAY |
| 49 | TODAY |
| 50 | TOMORROW |
| 51 | YESTERDAY |

### FAMILY (10 signs)
| ID | Label |
|----|-------|
| 52 | FATHER |
| 53 | MOTHER |
| 54 | SON |
| 55 | DAUGHTER |
| 56 | GRANDFATHER |
| 57 | GRANDMOTHER |
| 58 | UNCLE |
| 59 | AUNTIE |
| 60 | COUSIN |
| 61 | PARENTS |

### RELATIONSHIPS (10 signs)
| ID | Label |
|----|-------|
| 62 | BOY |
| 63 | GIRL |
| 64 | MAN |
| 65 | WOMAN |
| 66 | DEAF |
| 67 | HARD OF HEARING |
| 68 | WHEELCHAIR PERSON |
| 69 | BLIND |
| 70 | DEAF BLIND |
| 71 | MARRIED |

### COLOR (13 signs)
| ID | Label |
|----|-------|
| 72 | BLUE |
| 73 | GREEN |
| 74 | RED |
| 75 | BROWN |
| 76 | BLACK |
| 77 | WHITE |
| 78 | YELLOW |
| 79 | ORANGE |
| 80 | GRAY |
| 81 | PINK |
| 82 | VIOLET |
| 83 | LIGHT |
| 84 | DARK |

### FOOD (10 signs)
| ID | Label |
|----|-------|
| 85 | BREAD |
| 86 | EGG |
| 87 | FISH |
| 88 | MEAT |
| 89 | CHICKEN |
| 90 | SPAGHETTI |
| 91 | RICE |
| 92 | LONGANISA |
| 93 | SHRIMP |
| 94 | CRAB |

### DRINK (10 signs)
| ID | Label |
|----|-------|
| 95 | HOT |
| 96 | COLD |
| 97 | JUICE |
| 98 | MILK |
| 99 | COFFEE |
| 100 | TEA |
| 101 | BEER |
| 102 | WINE |
| 103 | SUGAR |
| 104 | NO SUGAR |

## Overlap with Database Tables

### `gestures` table
The `gestures` table contains **36 gesture entries** (all alphabet letters A-Z + ñ + ng + 8 phrase signs).
Only **8 of 105** FSL-105 signs exist as entries:
- GOOD MORNING, GOOD AFTERNOON, GOOD EVENING, THANK YOU, HELP, SORRY, PLEASE, YES, NO

The remaining **96 FSL-105 signs** have no corresponding `gestures` row.

### `gesture_replies` table
Replies are defined per gesture. Only the gestures that exist in `gestures` have replies.
The 96 missing gesture entries also have no replies.

## Implication
To fully support all 105 FSL-105 signs, the `gestures` table needs **97 new rows** (96 missing + fixing "WHEELCHAIR PERSON" spelling from WEELCHAIR PERSON). Each needs associated reference videos and replies.
