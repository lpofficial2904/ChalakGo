export const serviceContentDefaults = {
  'permanent-driver': {
    sectionEyebrow: 'PERMANENT DRIVER HIRE',
    sectionTitle: 'Hire a permanent driver for your daily routine.',
    sectionDescription: 'Get a reliable, professional driver for your home, office, or business needs. Every driver is background-checked, trained, and matched to your preferred schedule.',
    benefitsTitle: 'Why hire drivers from us?',
    benefits: 'Experienced & verified | Background-checked and professionally trained drivers.\nFlexible timings | Choose daily shift times that match your requirement.\nAffordable pricing | Transparent monthly salary packages with no surprises.\nTrusted service | Dedicated support and dependable driver matching.',
    plansTitle: 'Permanent driver hire plans',
    monthlyLeave: '4 days/month',
    otherTitle: 'Other services for employers',
    otherServices: 'Temporary Driver Services\nEvent Chauffeurs\nCorporate & Office Drivers\nOutstation & Travel Drivers',
  },
  'jaipur-tour': {
    plansEyebrow: 'CHOOSE YOUR EXPERIENCE',
    plansTitle: 'Pick the pace that suits you.',
    plansDescription: 'Select a plan to view its hand-picked stops, then reserve your private tour in a few minutes.',
    itineraryNote: 'The itinerary can be customised. Contact our team before travel for pickup time, route preferences, tolls, parking, and any additional charges.',
  },
}

export const contentOf = service => ({ ...serviceContentDefaults[service.slug], ...service.pageContent })
