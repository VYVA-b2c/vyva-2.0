import svgPaths from "./svg-nl0wrctnp3";

function Icon() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_67_147)" id="Icon">
          <path d={svgPaths.p39ee6532} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p14d10c00} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M1.33333 8H14.6667" id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
        <defs>
          <clipPath id="clip0_67_147">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text() {
  return (
    <div className="h-[20px] relative shrink-0 w-[61.925px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-[31px] text-[14px] text-center text-white top-[-1.2px] translate-x-[-50%] w-[62px]">🇬🇧 English</p>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.1)] content-stretch flex gap-[8px] h-[37.6px] items-center left-[1000.48px] pl-[16.8px] pr-[0.8px] py-[0.8px] rounded-[10px] top-0 w-[119.525px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Icon />
      <Text />
    </div>
  );
}

function Icon1() {
  return (
    <div className="absolute left-[16px] size-[20px] top-[10px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d="M12.5 15L7.5 10L12.5 5" id="Vector" stroke="var(--stroke-0, #59168B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-white h-[40px] relative rounded-[10px] shrink-0 w-[119.65px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Icon1 />
        <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[24px] left-[74.5px] text-[#59168b] text-[16px] text-center text-nowrap top-[5.8px] translate-x-[-50%] whitespace-pre">Previous</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="h-[24px] relative shrink-0 w-[87.925px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[24px] left-0 text-[16px] text-white top-[-2.2px] w-[88px]">Slide 12 / 12</p>
      </div>
    </div>
  );
}

function Icon2() {
  return (
    <div className="absolute left-[57.11px] size-[20px] top-[10px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d="M7.5 15L12.5 10L7.5 5" id="Vector" stroke="var(--stroke-0, #59168B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-white h-[40px] opacity-30 relative rounded-[10px] shrink-0 w-[93.113px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[24px] left-[33.5px] text-[#59168b] text-[16px] text-center text-nowrap top-[5.8px] translate-x-[-50%] whitespace-pre">Next</p>
        <Icon2 />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute content-stretch flex h-[40px] items-center justify-between left-0 pl-[16px] pr-[16.012px] py-0 top-[707.6px] w-[1120px]" data-name="Container">
      <Button1 />
      <Container />
      <Button2 />
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#45556c] relative rounded-[2.68435e+07px] shrink-0 size-[8px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid size-full" />
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-[#fdc700] h-[8px] relative rounded-[2.68435e+07px] shrink-0 w-[32px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid size-full" />
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[8px] items-start justify-center left-0 top-[763.6px] w-[1120px]" data-name="Container">
      {[...Array(11).keys()].map((_, i) => (
        <Button3 key={i} />
      ))}
      <Button4 />
    </div>
  );
}

function Icon3() {
  return (
    <div className="h-[630px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Vector"></g>
      </svg>
    </div>
  );
}

function Container3() {
  return (
    <div className="absolute content-stretch flex flex-col h-[630px] items-start left-0 opacity-10 top-0 w-[1120px]" data-name="Container">
      <Icon3 />
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[60px] relative shrink-0 w-[896px]" data-name="Heading 1">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[60px] left-0 text-[48px] text-nowrap text-white top-[-5.4px] whitespace-pre">{`Let's Build the Care Layer Together`}</p>
      </div>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[28px] relative shrink-0 w-[896px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[28px] left-0 text-[20px] text-[rgba(255,255,255,0.9)] text-nowrap top-[-2.2px] whitespace-pre">Your network. Our AI. Millions of families supported.</p>
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex h-[31.988px] items-start relative shrink-0 w-full" data-name="Heading 2">
      <p className="basis-0 font-['Arimo:Regular',sans-serif] font-normal grow leading-[32px] min-h-px min-w-px relative shrink-0 text-[#0f172b] text-[24px]">Contact</p>
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p24d83580} id="Vector" stroke="var(--stroke-0, #9810FA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pd919a80} id="Vector_2" stroke="var(--stroke-0, #9810FA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container4() {
  return (
    <div className="bg-purple-100 relative rounded-[2.68435e+07px] shrink-0 size-[40px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon4 />
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-0 text-[#45556c] text-[14px] text-nowrap top-[-1.2px] whitespace-pre">Email</p>
    </div>
  );
}

function Container6() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[24px] left-0 text-[#0f172b] text-[16px] text-nowrap top-[-2.2px] whitespace-pre">partnerships@mokadigital.net</p>
    </div>
  );
}

function Container7() {
  return (
    <div className="h-[44px] relative shrink-0 w-[212.313px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Container5 />
        <Container6 />
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="content-stretch flex gap-[12px] h-[44px] items-center relative shrink-0 w-full" data-name="Container">
      <Container4 />
      <Container7 />
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_67_130)" id="Icon">
          <path d={svgPaths.p14d24500} id="Vector" stroke="var(--stroke-0, #D08700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p17212180} id="Vector_2" stroke="var(--stroke-0, #D08700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M1.66667 10H18.3333" id="Vector_3" stroke="var(--stroke-0, #D08700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
        <defs>
          <clipPath id="clip0_67_130">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container9() {
  return (
    <div className="bg-[#fef9c2] relative rounded-[2.68435e+07px] shrink-0 size-[40px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon5 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-0 text-[#45556c] text-[14px] text-nowrap top-[-1.2px] whitespace-pre">Website</p>
    </div>
  );
}

function Container11() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[24px] left-0 text-[#0f172b] text-[16px] text-nowrap top-[-2.2px] whitespace-pre">vyva.life</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[44px] relative shrink-0 w-[55.813px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Container10 />
        <Container11 />
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex gap-[12px] h-[44px] items-center relative shrink-0 w-full" data-name="Container">
      <Container9 />
      <Container12 />
    </div>
  );
}

function Container14() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[16px] h-[104px] items-start left-0 top-0 w-[400px]" data-name="Container">
      <Container8 />
      <Container13 />
    </div>
  );
}

function Icon6() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d="M8.33333 10H11.6667" id="Vector" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M8.33333 6.66667H11.6667" id="Vector_2" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p16bb4600} id="Vector_3" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p3b103700} id="Vector_4" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p24196980} id="Vector_5" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container15() {
  return (
    <div className="bg-[#ffedd4] relative rounded-[2.68435e+07px] shrink-0 size-[40px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon6 />
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-0 text-[#45556c] text-[14px] text-nowrap top-[-1.2px] whitespace-pre">VYVA Health</p>
    </div>
  );
}

function Container17() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[24px] left-0 text-[#0f172b] text-[16px] text-nowrap top-[-2.2px] whitespace-pre">MOKA DIGITECK, S.L.</p>
    </div>
  );
}

function Container18() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-0 text-[#45556c] text-[14px] text-nowrap top-[-1.2px] whitespace-pre">Creators of VYVA</p>
    </div>
  );
}

function Container19() {
  return (
    <div className="basis-0 grow h-[68px] min-h-px min-w-px relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Container16 />
        <Container17 />
        <Container18 />
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="absolute content-stretch flex gap-[12px] h-[68px] items-center left-[432px] top-[18px] w-[199.613px]" data-name="Container">
      <Container15 />
      <Container19 />
    </div>
  );
}

function Container21() {
  return (
    <div className="h-[104px] relative shrink-0 w-full" data-name="Container">
      <Container14 />
      <Container20 />
    </div>
  );
}

function Container22() {
  return (
    <div className="bg-white h-[223.988px] relative rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] shrink-0 w-[896px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[24px] items-start pb-0 pt-[32px] px-[32px] relative size-full">
        <Heading1 />
        <Container21 />
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-[896px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[32px] items-start justify-center relative size-full">
        <Heading />
        <Paragraph />
        <Container22 />
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="h-[48px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[48px] left-[33px] text-[48px] text-center text-nowrap text-white top-[-5px] translate-x-[-50%] whitespace-pre">👵</p>
    </div>
  );
}

function Container25() {
  return (
    <div className="h-[20px] opacity-80 relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-[33.41px] text-[14px] text-center text-nowrap text-white top-[-1.2px] translate-x-[-50%] whitespace-pre">Seniors</p>
    </div>
  );
}

function Container26() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[76px] items-start left-[175.09px] top-0 w-[65.912px]" data-name="Container">
      <Container24 />
      <Container25 />
    </div>
  );
}

function Container27() {
  return (
    <div className="absolute h-[40px] left-[289px] opacity-60 top-[18px] w-[24.638px]" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[40px] left-0 text-[36px] text-nowrap text-white top-[-3px] whitespace-pre">+</p>
    </div>
  );
}

function Container28() {
  return (
    <div className="h-[48px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[48px] left-[33px] text-[48px] text-center text-nowrap text-white top-[-5px] translate-x-[-50%] whitespace-pre">📡</p>
    </div>
  );
}

function Container29() {
  return (
    <div className="h-[20px] opacity-80 relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-[33.77px] text-[14px] text-center text-nowrap text-white top-[-1.2px] translate-x-[-50%] whitespace-pre">Telco</p>
    </div>
  );
}

function Container30() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[76px] items-start left-[361.64px] top-0 w-[65.912px]" data-name="Container">
      <Container28 />
      <Container29 />
    </div>
  );
}

function Container31() {
  return (
    <div className="absolute h-[40px] left-[475.55px] opacity-60 top-[18px] w-[24.638px]" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[40px] left-0 text-[36px] text-nowrap text-white top-[-3px] whitespace-pre">+</p>
    </div>
  );
}

function Container32() {
  return (
    <div className="h-[48px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[48px] left-[30px] text-[48px] text-center text-nowrap text-white top-[-5px] translate-x-[-50%] whitespace-pre">👨‍👩‍👧</p>
    </div>
  );
}

function Container33() {
  return (
    <div className="h-[20px] opacity-80 relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-[30.09px] text-[14px] text-center text-nowrap text-white top-[-1.2px] translate-x-[-50%] whitespace-pre">Families</p>
    </div>
  );
}

function Container34() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[76px] items-start left-[548.19px] top-0 w-[60.15px]" data-name="Container">
      <Container32 />
      <Container33 />
    </div>
  );
}

function Container35() {
  return (
    <div className="absolute h-[40px] left-[656.34px] opacity-60 top-[18px] w-[24.638px]" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[40px] left-0 text-[36px] text-nowrap text-white top-[-3px] whitespace-pre">=</p>
    </div>
  );
}

function Container36() {
  return (
    <div className="h-[48px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[48px] left-[44.01px] text-[48px] text-center text-nowrap text-white top-[-5px] translate-x-[-50%] whitespace-pre">💚</p>
    </div>
  );
}

function Container37() {
  return (
    <div className="h-[20px] opacity-80 relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arimo:Regular',sans-serif] font-normal leading-[20px] left-[44px] text-[14px] text-center text-nowrap text-white top-[-1.2px] translate-x-[-50%] whitespace-pre">Peace of Mind</p>
    </div>
  );
}

function Container38() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[76px] items-start left-[728.98px] top-0 w-[87.938px]" data-name="Container">
      <Container36 />
      <Container37 />
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[76px] relative shrink-0 w-[992px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Container26 />
        <Container27 />
        <Container30 />
        <Container31 />
        <Container34 />
        <Container35 />
        <Container38 />
      </div>
    </div>
  );
}

function Container40() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[32px] h-[502px] items-start left-[64px] top-[64px] w-[992px]" data-name="Container">
      <Container23 />
      <Container39 />
    </div>
  );
}

function Slide14Cta() {
  return (
    <div className="h-[630px] overflow-clip relative shrink-0 w-full" data-name="Slide14CTA" style={{ backgroundImage: "linear-gradient(150.642deg, rgb(89, 22, 139) 0%, rgb(110, 17, 176) 50%, rgb(130, 0, 219) 100%)" }}>
      <Container3 />
      <Container40 />
    </div>
  );
}

function SlideLayout() {
  return (
    <div className="content-stretch flex flex-col h-[630px] items-start overflow-clip relative shrink-0 w-full" data-name="SlideLayout">
      <Slide14Cta />
    </div>
  );
}

function Container41() {
  return (
    <div className="absolute bg-white content-stretch flex flex-col h-[630px] items-start left-0 overflow-clip rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] top-[53.6px] w-[1120px]" data-name="Container">
      <SlideLayout />
    </div>
  );
}

function Container42() {
  return (
    <div className="h-[771.6px] relative shrink-0 w-[1120px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Button />
        <Container1 />
        <Container2 />
        <Container41 />
      </div>
    </div>
  );
}

export default function VyvaTelcoPartnershipDeck() {
  return (
    <div className="content-stretch flex items-center justify-center relative size-full" data-name="VYVA Telco Partnership Deck" style={{ backgroundImage: "linear-gradient(145.088deg, rgb(89, 22, 139) 0%, rgb(15, 23, 43) 50%, rgb(89, 22, 139) 100%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)" }}>
      <Container42 />
    </div>
  );
}