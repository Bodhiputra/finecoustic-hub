/** Structured KOL collaboration playbook — Marketing workspace. */

export const KOL_GUIDELINES_SECTIONS = [
  {
    id: 'mindset',
    title: 'KOL Collaboration Mindset',
    summary: 'Collaboration is mutual — quality of relationship over quantity.',
    blocks: [
      {
        type: 'subheading',
        text: 'Collaboration is Mutual',
      },
      {
        type: 'paragraph',
        text: 'KOL collaboration is not only about getting exposure.',
      },
      {
        type: 'split',
        items: [
          {
            title: 'Creators provide',
            tone: 'creators',
            bullets: [
              'Audience trust',
              'Creative skills',
              'High-quality content',
              'Honest product feedback (for Finecoustic Finest Thoughts and future brand storytelling)',
            ],
          },
          {
            title: 'Finecoustic provides',
            tone: 'brand',
            bullets: [
              'Product experience',
              'Brand exposure opportunity',
              'Support and flexibility',
            ],
          },
        ],
      },
      {
        type: 'callout',
        tone: 'accent',
        text: 'Our goal is to build genuine relationships, not simply collect content.',
      },
      {
        type: 'callout',
        tone: 'brand',
        text: 'Quality of relationship > Quantity of collaborations',
      },
    ],
  },
  {
    id: 'approach',
    title: 'How We Approach KOLs',
    summary: 'Research first, personalize every message, be transparent about terms.',
    blocks: [
      {
        type: 'subheading',
        text: 'Before Contacting',
      },
      {
        type: 'paragraph',
        text: 'Always:',
      },
      {
        type: 'checklist',
        tone: 'do',
        items: [
          'Visit their page first',
          'Understand their content style',
          'Find 1–2 specific things that genuinely caught our attention',
          'Make sure their audience fits Finecoustic',
        ],
      },
      {
        type: 'paragraph',
        text: 'Never send generic messages.',
      },
      {
        type: 'paragraph',
        text: 'Creators should feel: "Finecoustic actually knows my work."',
      },
      {
        type: 'steps',
        title: 'First Message Structure',
        steps: [
          {
            title: '1. Warm Opening',
            body: 'Start naturally:',
            example: "Hope you're doing great!",
            body2: 'A simple greeting is always a good way to start a conversation.',
          },
          {
            title: '2. Introduce Yourself + Finecoustic',
            exampleLabel: 'Example:',
            example:
              "I'm Bodhi from Finecoustic. We're a new audio brand currently preparing for the launch of our Hako Nomad portable speaker.",
          },
          {
            title: '3. Explain Why We Chose Them',
            body: 'Mention something specific about their content.',
            listLabel: 'It can be:',
            bullets: [
              'Their visual style',
              'Their setup',
              'Their lifestyle',
              'Their storytelling',
              'Similar products they have featured before',
            ],
            body2:
              'Mentioning competitors is okay, but never make comparisons or position Finecoustic as better.',
            exampleLabel: 'Example:',
            example:
              "I love your setup and couldn't help but notice that you also have an Edifier speaker featured in your content. Hako Nomad was designed with aesthetics in mind, and I immediately thought it would fit naturally within your content style and audience.",
          },
          {
            title: '4. Explain Collaboration Terms Clearly',
            body: 'Be transparent from the beginning:',
            example:
              "We're still a relatively new brand, so our marketing budget is quite limited. At the moment, our collaboration budget is allocated towards gifting the product and covering all shipping costs. That said, we're quite flexible with the deliverables. An organic Instagram collaboration reel would be wonderful, but even a simple mention or tag if you genuinely enjoy the product would be greatly appreciated.",
            listLabel: 'Key points:',
            bullets: [
              'Product gifting collaboration',
              'Shipping covered by Finecoustic',
              'Flexible deliverables',
              'Genuine feedback matters most',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'communication',
    title: 'Communication Rules',
    summary: 'Stay human, stay honest, keep relationships open.',
    blocks: [
      {
        type: 'subheading',
        text: 'Always Be Human',
      },
      {
        type: 'split',
        items: [
          {
            title: 'Do',
            tone: 'do',
            bullets: [
              'Be friendly',
              'Show personality',
              'Appreciate their work',
              'Use AI only to polish grammar',
            ],
          },
          {
            title: "Don't",
            tone: 'dont',
            bullets: [
              'Sound like automated marketing',
              'Copy-paste messages',
              'Overpromise',
              'Give false expectations',
            ],
          },
        ],
      },
      {
        type: 'subheading',
        text: 'Keep Relationships Open',
      },
      {
        type: 'paragraph',
        text: 'Even if the collaboration does not happen, always leave a positive impression.',
      },
      {
        type: 'example',
        label: 'Example',
        text:
          'Thank you so much for your time. We hope we can stay connected and hopefully find an opportunity to work together in the future. Wishing you the best with your upcoming projects!',
      },
    ],
  },
  {
    id: 'process',
    title: 'Collaboration Process',
    summary: 'Confirm → ship → track → feedback. Step-by-step.',
    blocks: [
      {
        type: 'steps',
        steps: [
          {
            title: 'Step 1 — Confirm Content',
            body: 'Before shipping:',
            bullets: ['Always confirm that they are willing to create content.'],
            body2: 'Never assume receiving the product means content is guaranteed.',
            bulletsLabel2: 'Clarify:',
            bullets2: ['Whether they plan to create content'],
          },
          {
            title: 'Step 2 — Shipping',
            body: 'Please kindly provide your mailing address in this specific format:',
            template: `Recipient Full Name:
Recipient Address:
Receiving City:
Postcode:
Province:
Country:
E-mail address:
Phone Number:
TAX/VAT/EORI Number (Personal TAX Number):(Based on your country's standard format - If any):`,
            footerLabel: 'Then:',
            footer:
              'We will relay this information to our shipping team and Hako Nomad will be on its way soon.',
          },
          {
            title: 'Step 3.1 — Send them tracking link and media kit',
            body:
              'I wanted to share an update with you regarding the tracking link and media kit for Hako Nomad',
            links: [
              {
                label: 'tracking link',
                href: 'https://t.17track.net/en#nums=UL409817631YP',
              },
              {
                label: 'media kit',
                href: 'https://drive.google.com/drive/folders/1U6MPUxjyaYv7UrvWkq0Dnpo1k1aahw-l?usp=sharing',
              },
            ],
            listLabel: "Inside the media kit, you'll find:",
            bullets: [
              'Short brand story',
              'Creator reviews',
              "What's inside the box",
              'Product specifications',
              'Collaboration overview',
              'Visual assets and social links',
            ],
            notesLabel: 'A few notes for the collaboration:',
            notes: [
              'When sharing about Hako Nomad, we would appreciate it if you could mention both Hako Nomad variants (Hako Nomad and Hako Nomad L) and Hako Nomad is now available to be purchased in our website (finecoustic.com)',
              'Please note that the strap is not designed to be removed. Any product modifications should only be considered after the collaboration content has been completed',
            ],
            example: 'if you have any questions, please ask awayy, would be glad to help!',
          },
          {
            title: 'Step 3.2 — Track Delivery',
            body: 'Always monitor the tracking link.',
            listLabel: 'When delivered:',
            example:
              'Hey there! I checked the tracking link and it shows that Hako Nomad has been delivered. Just wanted to confirm, did everything arrive safely at your place? Was the package in good condition?',
          },
          {
            title: 'Step 4 — Ask for Honest Feedback',
            body: 'After they receive the product:',
            body2: 'Always ask for their honest first impressions.',
            example:
              'By any chance, have you had the chance to try Hako Nomad? I would really love to hear your honest thoughts.',
            body3:
              'Also can continue with asking for content planning/posting timeline:',
            example2:
              'by any chance, do you already have a schedule in mind to work on the collaboration content or posting time?',
            notesLabel: 'Important:',
            notesIntro: 'Honest feedback can be used for:',
            notes: [
              'Finecoustic Finest Thoughts section (customer-facing testimonials)',
              'Media kits',
              'Brand storytelling',
            ],
            notesOutro: 'Not only social media captions.',
            bulletsLabel2: 'Remember:',
            bullets2: [
              'Honest feedback is more valuable than perfect feedback.',
              'Negative feedback is also important because it helps Finecoustic improve.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'paid',
    title: 'Paid Partnership Requests',
    summary: 'Not an automatic rejection — collect info for future opportunities.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Paid request ≠ automatic rejection.',
      },
      {
        type: 'paragraph',
        text: 'If they ask:',
      },
      {
        type: 'example',
        label: 'Reply',
        text:
          'We completely understand. Currently, our collaboration budget is focused on product gifting and shipping costs. However, we would love to keep your rate card for future opportunities.',
      },
      {
        type: 'checklist',
        title: 'Always collect',
        tone: 'neutral',
        items: ['Rate card', 'Previous work examples', 'Deliverable options'],
      },
    ],
  },
  {
    id: 'profile',
    title: 'Finecoustic Creator Profile',
    summary: 'Who we look for — and who fits each product line.',
    blocks: [
      {
        type: 'subheading',
        text: 'Preferred Creators',
      },
      {
        type: 'paragraph',
        text: "We look for creators who match Finecoustic's design-focused lifestyle direction.",
      },
      {
        type: 'split',
        items: [
          {
            title: 'Preferred',
            tone: 'do',
            bullets: [
              'English-speaking creators',
              'US / European creators preferred',
              'Cinematic creators',
              'Lifestyle creators',
              'Minimalist creators',
              'Creative tech reviewers',
              'Strong visual identity',
            ],
          },
          {
            title: 'Avoid',
            tone: 'dont',
            bullets: [
              'Audiophile-only creators',
              'Spec-focused reviewers',
              'AI-generated creators',
            ],
          },
        ],
      },
      {
        type: 'cards',
        items: [
          {
            title: 'Hako Nomad',
            sections: [
              {
                label: 'Best fit',
                bullets: [
                  'Living space creators',
                  'Lifestyle creators',
                  'Digital nomads',
                  'Minimalist creators',
                  'Cinematic reviewers',
                ],
              },
              {
                label: 'Audience',
                text: 'Hundreds → Under 100K followers',
              },
            ],
          },
          {
            title: 'Hako Studio',
            sections: [
              {
                label: 'Best fit',
                bullets: [
                  'Desk setup creators',
                  'Work-from-home creators',
                  'Creative workspace creators',
                  'Small listening studio creators',
                  'Chill DJ creators',
                ],
              },
              {
                label: 'Audience',
                text: 'Hundreds → Under 100K followers',
              },
            ],
          },
        ],
      },
      {
        type: 'subheading',
        text: 'Golden Rules',
      },
      {
        type: 'rules',
        items: [
          'Always be genuine',
          'Always research before approaching',
          'Always explain collaboration terms clearly',
          "Always respect creators' creative freedom",
          'Always ask for honest feedback',
          'Always keep relationships open',
        ],
      },
      {
        type: 'paragraph',
        text: 'Finecoustic is not only about sound.',
      },
      {
        type: 'paragraph',
        text: 'We represent:',
      },
      {
        type: 'callout',
        tone: 'brand',
        text: 'Sound + Space + Lifestyle + Personal Expression',
      },
    ],
  },
];
