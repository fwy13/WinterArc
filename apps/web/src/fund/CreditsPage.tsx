import { CLUB } from '../config/club';
import { ClubLogo,ClubSocials } from '../components/ClubBrand';
import FundPanel from './FundPanel';
export default function CreditsPage(){return <main className="credits-page"><header><a href="/">← Winter Arc</a><a href="/admin">Quản trị</a></header><section className="credits-brand"><ClubLogo/><small>ĐƯỢC PHÁT TRIỂN BỞI</small><h1>{CLUB.name}</h1><ClubSocials/><a href={`mailto:${CLUB.email}`}>{CLUB.email}</a></section><FundPanel/></main>;}
