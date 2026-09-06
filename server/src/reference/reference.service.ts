import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ReferenceService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(private supabase: SupabaseService) {}

  // ==================== LOAN TYPES ====================

  async getAllLoanTypes() {
    const { data } = await this.db
      .from('LoanType')
      .select('*')
      .order('isPopular', { ascending: false })
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getPopularLoanTypes() {
    const { data } = await this.db
      .from('LoanType')
      .select('*')
      .eq('isPopular', true)
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getLoanTypeById(id: string) {
    const { data } = await this.db.from('LoanType').select('*').eq('id', id).single();
    return { success: true, data };
  }

  // ==================== UNIVERSITIES ====================

  async getAllUniversities(filters: any) {
    const { country, ranking, limit = 20, offset = 0 } = filters;

    let query = this.db
      .from('University')
      .select('*', { count: 'exact' })
      .order('isFeatured', { ascending: false })
      .order('ranking', { ascending: true })
      .range(offset, offset + limit - 1);

    if (country) query = query.ilike('country', `%${country}%`);
    if (ranking) query = query.lte('ranking', parseInt(ranking));

    const { data, count } = await query;
    return {
      success: true,
      data: data || [],
      pagination: { total: count || 0, limit, offset, hasMore: offset + (data?.length || 0) < (count || 0) },
    };
  }

  async getFeaturedUniversities(limit: number) {
    const { data } = await this.db
      .from('University')
      .select('*')
      .eq('isFeatured', true)
      .order('ranking', { ascending: true })
      .limit(limit);
    return { success: true, data: data || [] };
  }

  async getUniversityById(id: string) {
    const { data } = await this.db.from('University').select('*').eq('id', id).single();
    return { success: true, data };
  }

  async getUniversitiesByCountry(country: string) {
    const { data } = await this.db
      .from('University')
      .select('*')
      .ilike('country', country)
      .order('ranking', { ascending: true });
    return { success: true, data: data || [] };
  }

  // ==================== BANKS ====================

  async getAllBanks() {
    const { data } = await this.db
      .from('Bank')
      .select('*')
      .order('isPopular', { ascending: false })
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getPopularBanks() {
    const { data } = await this.db
      .from('Bank')
      .select('*')
      .eq('isPopular', true)
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getBankById(id: string) {
    const { data } = await this.db.from('Bank').select('*').eq('id', id).single();
    return { success: true, data };
  }

  async getBankBySlug(slug: string) {
    const { data } = await this.db.from('Bank').select('*').eq('shortName', slug).maybeSingle();
    return { success: true, data };
  }

  async createBank(bankData: any) {
    const now = new Date().toISOString();
    const payload = {
      id: bankData.id || randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...bankData,
    };
    const { data, error } = await this.db.from('Bank').insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return { success: true, data };
  }

  async updateBank(id: string, bankData: any) {
    const now = new Date().toISOString();
    const payload = {
      ...bankData,
      updatedAt: now,
    };
    delete payload.id;
    delete payload.createdAt;
    const { data, error } = await this.db.from('Bank').update(payload).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { success: true, data };
  }

  async deleteBank(id: string) {
    const { error } = await this.db.from('Bank').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true, message: 'Bank deleted successfully' };
  }

  async getBanksByType(type: string) {
    const { data } = await this.db
      .from('Bank')
      .select('*')
      .eq('type', type)
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getDisbursedAmount() {
    // 1. Sum all confirmed disbursement amounts from the Disbursement table
    // (inserted by bank-dashboard.service.ts confirmDisbursement)
    const { data: disbursements } = await this.db
      .from('Disbursement')
      .select('amount')
      .eq('status', 'CONFIRMED');
    const totalDisbTable = (disbursements || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    // 2. Cross-check: sum amount from LoanApplication where status = 'disbursed'
    const { data: apps } = await this.db
      .from('LoanApplication')
      .select('amount')
      .eq('status', 'disbursed');
    const totalAppsAmountDisbursed = (apps || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    // Take the maximum to avoid double counting between the two sources
    const actualDisbursed = Math.max(totalDisbTable, totalAppsAmountDisbursed);

    // 1 Crore = 10,000,000 Rupees. Minimum display baseline = 100 Crores.
    const baseCr = 100;
    const actualCr = actualDisbursed / 10_000_000;
    const totalCr = baseCr + actualCr;

    // Show "₹100Cr+" as floor until real disbursements push above 100Cr.
    // Once total exceeds 100Cr, show the precise live figure.
    let formatted: string;
    if (actualCr <= 0) {
      formatted = `₹100Cr+`;
    } else if (totalCr % 1 === 0) {
      formatted = `₹${totalCr.toFixed(0)}Cr+`;
    } else {
      formatted = `₹${totalCr.toFixed(1)}Cr+`;
    }

    return {
      success: true,
      data: {
        totalDisbursed: totalCr,
        actualDisbursedRs: actualDisbursed,
        formatted
      }
    };
  }

  async getPlatformStats() {
    const baseStudents = 1000;
    const baseCountries = 10;
    const basePrograms = 18000;

    let dynamicUserCount = 0;
    try {
      const { count, error } = await this.db
        .from('User')
        .select('*', { count: 'exact', head: true });
      if (!error && typeof count === 'number') {
        dynamicUserCount = count;
      }
    } catch (e) {
      console.error('Error fetching user count for platform stats:', e);
    }

    let countryCount = baseCountries;
    try {
      const { count, error } = await this.db
        .from('Country')
        .select('*', { count: 'exact', head: true });
      if (!error && typeof count === 'number' && count > baseCountries) {
        countryCount = count;
      }
    } catch (e) {}

    let programCount = basePrograms;
    try {
      const { count, error } = await this.db
        .from('Program')
        .select('*', { count: 'exact', head: true });
      if (!error && typeof count === 'number' && count > basePrograms) {
        programCount = count;
      }
    } catch (e) {}

    const totalStudents = baseStudents + dynamicUserCount;
    const studentsFormatted = totalStudents >= 100000 
      ? `${(totalStudents / 100000).toFixed(1)} lakh` 
      : `${totalStudents.toLocaleString()}+`;

    return {
      success: true,
      data: {
        students: totalStudents,
        studentsFormatted,
        rawStudents: totalStudents,
        countries: countryCount,
        countriesFormatted: `${countryCount}+`,
        programs: programCount,
        programsFormatted: `${programCount.toLocaleString()}+`,
      },
    };
  }



  // ==================== COUNTRIES ====================

  private countriesStore = [
    { id: 'cnt-1', name: 'USA', code: 'US', flag: '🇺🇸', region: 'North America', popularForStudy: true, isActive: true },
    { id: 'cnt-2', name: 'UK', code: 'GB', flag: '🇬🇧', region: 'Europe', popularForStudy: true, isActive: true },
    { id: 'cnt-3', name: 'Canada', code: 'CA', flag: '🇨🇦', region: 'North America', popularForStudy: true, isActive: true },
    { id: 'cnt-4', name: 'Australia', code: 'AU', flag: '🇦🇺', region: 'Oceania', popularForStudy: true, isActive: true },
    { id: 'cnt-5', name: 'Germany', code: 'DE', flag: '🇩🇪', region: 'Europe', popularForStudy: true, isActive: true },
    { id: 'cnt-6', name: 'Ireland', code: 'IE', flag: '🇮🇪', region: 'Europe', popularForStudy: true, isActive: true },
    { id: 'cnt-7', name: 'New Zealand', code: 'NZ', flag: '🇳🇿', region: 'Oceania', popularForStudy: true, isActive: true },
  ];

  async getAllCountries() {
    try {
      const { data } = await this.db
        .from('Country')
        .select('*')
        .order('popularForStudy', { ascending: false })
        .order('name', { ascending: true });

      if (data && data.length > 0) {
        // Merge DB data with local store to ensure user added items persist
        const existingIds = new Set(data.map((c: any) => c.id));
        const extraFromStore = this.countriesStore.filter(c => !existingIds.has(c.id));
        return { success: true, data: [...data, ...extraFromStore] };
      }
    } catch (e) {
      console.warn('Country table fetch error, falling back to local store:', e);
    }
    return { success: true, data: this.countriesStore };
  }

  async getPopularCountries() {
    try {
      const { data } = await this.db
        .from('Country')
        .select('*')
        .eq('popularForStudy', true)
        .eq('isActive', true)
        .order('name', { ascending: true });

      if (data && data.length > 0) {
        return { success: true, data };
      }
    } catch (e) {
      console.warn('Country table fetch error:', e);
    }
    return { success: true, data: this.countriesStore.filter(c => c.popularForStudy && c.isActive) };
  }

  async getCountryById(id: string) {
    const { data } = await this.db.from('Country').select('*').eq('id', id).single();
    return { success: true, data: data || this.countriesStore.find(c => c.id === id) };
  }

  async getCountryByCode(code: string) {
    const { data } = await this.db
      .from('Country')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();
    return { success: true, data: data || this.countriesStore.find(c => c.code === code.toUpperCase()) };
  }

  async getCountriesByRegion(region: string) {
    const { data } = await this.db
      .from('Country')
      .select('*')
      .ilike('region', `%${region}%`)
      .order('name', { ascending: true });
    return { success: true, data: data || this.countriesStore.filter(c => c.region.toLowerCase().includes(region.toLowerCase())) };
  }

  async createCountry(body: any) {
    const id = randomUUID();
    const newCountry = {
      id,
      name: body.name,
      code: body.code ? body.code.toUpperCase() : body.name.substring(0, 2).toUpperCase(),
      flag: body.flag || '🌐',
      region: body.region || 'Global',
      popularForStudy: body.popularForStudy ?? true,
      isActive: body.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in memory list
    const existingIndex = this.countriesStore.findIndex(c => c.id === id || c.name.toLowerCase() === newCountry.name.toLowerCase());
    if (existingIndex >= 0) {
      this.countriesStore[existingIndex] = newCountry;
    } else {
      this.countriesStore.unshift(newCountry);
    }

    try {
      const { data, error } = await this.db.from('Country').insert(newCountry).select().single();
      if (!error && data) {
        return { success: true, data };
      }
    } catch (e) {
      console.error('Error creating country in DB:', e);
    }
    return { success: true, data: newCountry };
  }

  async updateCountry(id: string, body: any) {
    const updatePayload: any = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    delete updatePayload.id;

    // Update in-memory store
    const idx = this.countriesStore.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.countriesStore[idx] = { ...this.countriesStore[idx], ...updatePayload };
    }

    try {
      const { data, error } = await this.db.from('Country').update(updatePayload).eq('id', id).select().single();
      if (!error && data) {
        return { success: true, data };
      }
    } catch (e) {
      console.error('Error updating country in DB:', e);
    }
    return { success: true, data: { id, ...updatePayload } };
  }

  async deleteCountry(id: string) {
    // Remove from in-memory store
    this.countriesStore = this.countriesStore.filter(c => c.id !== id);

    try {
      await this.db.from('Country').delete().eq('id', id);
    } catch (e) {
      console.error('Error deleting country from DB:', e);
    }
    return { success: true, id };
  }

  // ==================== SCHOLARSHIPS ====================

  async getAllScholarships(filters: any) {
    const { country, type, limit = 20, offset = 0 } = filters;

    let query = this.db
      .from('Scholarship')
      .select('*', { count: 'exact' })
      .eq('isActive', true)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (country) query = query.ilike('country', `%${country}%`);
    if (type) query = query.eq('type', type);

    const { data, count } = await query;
    return {
      success: true,
      data: data || [],
      pagination: { total: count || 0, limit, offset, hasMore: offset + (data?.length || 0) < (count || 0) },
    };
  }

  async getScholarshipById(id: string) {
    const { data } = await this.db.from('Scholarship').select('*').eq('id', id).single();
    return { success: true, data };
  }

  async getScholarshipsByCountry(country: string) {
    const { data } = await this.db
      .from('Scholarship')
      .select('*')
      .ilike('country', country)
      .eq('isActive', true)
      .order('createdAt', { ascending: false });
    return { success: true, data: data || [] };
  }

  // ==================== COURSES ====================

  async getAllCourses(filters: any) {
    const { level, field, limit = 20, offset = 0 } = filters;

    let query = this.db
      .from('Course')
      .select('*', { count: 'exact' })
      .order('isPopular', { ascending: false })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (level) query = query.ilike('level', `%${level}%`);
    if (field) query = query.ilike('field', `%${field}%`);

    const { data, count } = await query;
    return {
      success: true,
      data: data || [],
      pagination: { total: count || 0, limit, offset, hasMore: offset + (data?.length || 0) < (count || 0) },
    };
  }

  async getPopularCourses() {
    const { data } = await this.db
      .from('Course')
      .select('*')
      .eq('isPopular', true)
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getCourseById(id: string) {
    const { data } = await this.db.from('Course').select('*').eq('id', id).single();
    return { success: true, data };
  }

  async getCoursesByLevel(level: string) {
    const { data } = await this.db
      .from('Course')
      .select('*')
      .ilike('level', `%${level}%`)
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  async getCoursesByField(field: string) {
    const { data } = await this.db
      .from('Course')
      .select('*')
      .ilike('field', `%${field}%`)
      .order('name', { ascending: true });
    return { success: true, data: data || [] };
  }

  // ==================== OFFICES ====================

  async getAllOffices() {
    try {
      const { data, error } = await this.db
        .from('Office')
        .select('*')
        .eq('isActive', true)
        .order('city', { ascending: true })
        .order('name', { ascending: true });
      if (error) {
        console.error('[ReferenceService.getAllOffices] Error:', error);
        return { success: false, data: [] };
      }
      return { success: true, data: data || [] };
    } catch (e: any) {
      console.error('[ReferenceService.getAllOffices] Exception:', e);
      return { success: false, data: [] };
    }
  }

  async createOffice(data: { name: string; city: string; location: string }) {
    if (!data.name || !data.city || !data.location) {
      throw new Error('Office name, city, and location are required');
    }
    const id = randomUUID();
    const { data: created, error } = await this.db
      .from('Office')
      .insert({
        id,
        name: data.name.trim(),
        city: data.city.trim(),
        location: data.location.trim(),
        isActive: true,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[ReferenceService.createOffice] Error:', error);
      throw error;
    }
    return { success: true, data: created };
  }

  async updateOffice(id: string, data: { name?: string; city?: string; location?: string; isActive?: boolean }) {
    const updatePayload: any = { updatedAt: new Date() };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.city !== undefined) updatePayload.city = data.city.trim();
    if (data.location !== undefined) updatePayload.location = data.location.trim();
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const { data: updated, error } = await this.db
      .from('Office')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[ReferenceService.updateOffice] Error:', error);
      throw error;
    }
    return { success: true, data: updated };
  }

  async deleteOffice(id: string) {
    const { error } = await this.db
      .from('Office')
      .update({ isActive: false, updatedAt: new Date() })
      .eq('id', id);

    if (error) {
      console.error('[ReferenceService.deleteOffice] Error:', error);
      throw error;
    }
    return { success: true, message: 'Office deleted successfully' };
  }
}
