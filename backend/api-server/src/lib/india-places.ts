// Extra monitored places across India: every state capital, every union
// territory capital and other large cities. Each one gets live weather from
// Open-Meteo. Any other town or village can be looked up on the Explore page.
// Format: [city, state or union territory, latitude, longitude, kind]
export type IndiaPlace = readonly [city: string, state: string, lat: number, lon: number, kind: "capital" | "city"];

export const INDIA_PLACES: readonly IndiaPlace[] = [
  // State capitals
  ["Amaravati", "Andhra Pradesh", 16.5731, 80.3573, "capital"],
  ["Itanagar", "Arunachal Pradesh", 27.0844, 93.6053, "capital"],
  ["Dispur", "Assam", 26.1433, 91.7898, "capital"],
  ["Patna", "Bihar", 25.5941, 85.1376, "capital"],
  ["Raipur", "Chhattisgarh", 21.2514, 81.6296, "capital"],
  ["Panaji", "Goa", 15.4909, 73.8278, "capital"],
  ["Gandhinagar", "Gujarat", 23.2156, 72.6369, "capital"],
  ["Shimla", "Himachal Pradesh", 31.1048, 77.1734, "capital"],
  ["Ranchi", "Jharkhand", 23.3441, 85.3096, "capital"],
  ["Bengaluru", "Karnataka", 12.9716, 77.5946, "capital"],
  ["Thiruvananthapuram", "Kerala", 8.5241, 76.9366, "capital"],
  ["Bhopal", "Madhya Pradesh", 23.2599, 77.4126, "capital"],
  ["Mumbai", "Maharashtra", 19.076, 72.8777, "capital"],
  ["Imphal", "Manipur", 24.817, 93.9368, "capital"],
  ["Shillong", "Meghalaya", 25.5788, 91.8933, "capital"],
  ["Aizawl", "Mizoram", 23.7271, 92.7176, "capital"],
  ["Kohima", "Nagaland", 25.6747, 94.1086, "capital"],
  ["Bhubaneswar", "Odisha", 20.2961, 85.8245, "capital"],
  ["Chandigarh", "Punjab and Haryana (UT)", 30.7333, 76.7794, "capital"],
  ["Gangtok", "Sikkim", 27.3389, 88.6065, "capital"],
  ["Agartala", "Tripura", 23.8315, 91.2868, "capital"],
  ["Lucknow", "Uttar Pradesh", 26.8467, 80.9462, "capital"],
  ["Dehradun", "Uttarakhand", 30.3165, 78.0322, "capital"],
  // Union territory capitals
  ["Port Blair", "Andaman and Nicobar Islands", 11.6234, 92.7265, "capital"],
  ["Daman", "Dadra and Nagar Haveli and Daman and Diu", 20.3974, 72.8328, "capital"],
  ["Srinagar", "Jammu and Kashmir", 34.0837, 74.7973, "capital"],
  ["Leh", "Ladakh", 34.1526, 77.5771, "capital"],
  ["Kavaratti", "Lakshadweep", 10.5626, 72.6369, "capital"],
  ["Puducherry", "Puducherry", 11.9416, 79.8083, "capital"],
  // Other large cities
  ["Surat", "Gujarat", 21.1702, 72.8311, "city"],
  ["Vadodara", "Gujarat", 22.3072, 73.1812, "city"],
  ["Rajkot", "Gujarat", 22.3039, 70.8022, "city"],
  ["Nagpur", "Maharashtra", 21.1458, 79.0882, "city"],
  ["Nashik", "Maharashtra", 19.9975, 73.7898, "city"],
  ["Indore", "Madhya Pradesh", 22.7196, 75.8577, "city"],
  ["Gwalior", "Madhya Pradesh", 26.2183, 78.1828, "city"],
  ["Jabalpur", "Madhya Pradesh", 23.1815, 79.9864, "city"],
  ["Visakhapatnam", "Andhra Pradesh", 17.6868, 83.2185, "city"],
  ["Vijayawada", "Andhra Pradesh", 16.5062, 80.648, "city"],
  ["Kochi", "Kerala", 9.9312, 76.2673, "city"],
  ["Coimbatore", "Tamil Nadu", 11.0168, 76.9558, "city"],
  ["Madurai", "Tamil Nadu", 9.9252, 78.1198, "city"],
  ["Tiruchirappalli", "Tamil Nadu", 10.7905, 78.7047, "city"],
  ["Mysuru", "Karnataka", 12.2958, 76.6394, "city"],
  ["Mangaluru", "Karnataka", 12.9141, 74.856, "city"],
  ["Jodhpur", "Rajasthan", 26.2389, 73.0243, "city"],
  ["Udaipur", "Rajasthan", 24.5854, 73.7125, "city"],
  ["Bikaner", "Rajasthan", 28.0229, 73.3119, "city"],
  ["Varanasi", "Uttar Pradesh", 25.3176, 82.9739, "city"],
  ["Kanpur", "Uttar Pradesh", 26.4499, 80.3319, "city"],
  ["Agra", "Uttar Pradesh", 27.1767, 78.0081, "city"],
  ["Prayagraj", "Uttar Pradesh", 25.4358, 81.8463, "city"],
  ["Amritsar", "Punjab", 31.634, 74.8723, "city"],
  ["Ludhiana", "Punjab", 30.901, 75.8573, "city"],
  ["Jammu", "Jammu and Kashmir", 32.7266, 74.857, "city"],
  ["Guwahati", "Assam", 26.1445, 91.7362, "city"],
  ["Siliguri", "West Bengal", 26.7271, 88.3953, "city"],
  ["Jamshedpur", "Jharkhand", 22.8046, 86.2029, "city"],
  ["Dhanbad", "Jharkhand", 23.7957, 86.4304, "city"],
  ["Cuttack", "Odisha", 20.4625, 85.883, "city"],
  ["Rourkela", "Odisha", 22.2604, 84.8536, "city"],
  ["Puri", "Odisha", 19.8135, 85.8312, "city"],
];

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const indiaPlaceId = (city: string): string => `in-${slug(city)}`;
